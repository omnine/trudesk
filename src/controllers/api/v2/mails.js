/*
 *                                               $$\                     $$\
 *                                               $$ |                    $$ |
 * $$$$$$$\   $$$$$$\  $$$$$$$\   $$$$$$\   $$$$$$$ | $$$$$$\   $$$$$$$\ $$ |  $$\
 * $$  __$$\  \____$$\ $$  __$$\ $$  __$$\ $$  __$$ |$$  __$$\ $$  _____|$$ | $$  |
 * $$ |  $$ | $$$$$$$ |$$ |  $$ |$$ /  $$ |$$ /  $$ |$$$$$$$$ |\$$$$$$\  $$$$$$  /
 * $$ |  $$ |$$  __$$ |$$ |  $$ |$$ |  $$ |$$ |  $$ |$$   ____| \____$$\ $$  _$$<
 * $$ |  $$ |\$$$$$$$ |$$ |  $$ |\$$$$$$  |\$$$$$$$ |\$$$$$$$\ $$$$$$$  |$$ | \$$\
 * \__|  \__| \_______|\__|  \__| \______/  \_______| \_______|\_______/ \__|  \__|
 *  ========================================================================
 *  Author:     Omnine
 *  Updated:    6/14/21 2:32 AM
 *  Copyright (c) 2014-2019. All rights reserved.
 */

var _ = require('lodash')
var async = require('async')
var winston = require('winston')
var ews = require('ews-javascript-api')

var Ticket = require('../../../models/ticket')
var emitter = require('../../../emitter')
var userSchema = require('../../../models/user')
var groupSchema = require('../../../models/group')
var ticketTypeSchema = require('../../../models/tickettype')

var Team = require('../../../models/team')
var apiUtils = require('../apiUtils')
var ewsCheck = require('../../../mailer/ewsCheck')

function createTicket (req, res, email, conversation, cb) {
  var message = {}
  message.from = email.From.Address
  message.subject = email.Subject
  message.body = ewsCheck.toMD(email.UniqueBody)
  if (message.body.length == 0) {
    //the email body may be empty, it will fail the validation on ticket creation
    message.body = message.subject //use the subject
  }
  //some fields are mandatory,
  async.auto(
    {
      //get owner
      handleUser: function (callback) {
        userSchema.getUserByEmail(message.from, function (err, user) {
          if (err) winston.warn(err)
          if (!err && user) {
            message.owner = user
            return callback(null, user)
          }
          // The client doesn't exist. Use the agent who is converting this email to case
          message.owner = req.user // any group info in req.user?
          return callback(null, req.user)
        })
      },
      handleGroup: [
        'handleUser',
        function (results, callback) {
          if (!_.isUndefined(message.group)) {
            return callback()
          }

          groupSchema.getAllGroupsOfUser(message.owner._id, function (err, group) {
            if (err) return callback(err)
            if (!group) return callback('Unknown group for user: ' + message.owner.email)

            if (_.isArray(group)) {
              message.group = _.first(group)
            } else {
              message.group = group
            }

            if (!message.group) {
              groupSchema.create(
                {
                  name: message.owner.email,
                  members: [message.owner._id],
                  sendMailTo: [message.owner._id],
                  public: true
                },
                function (err, group) {
                  if (err) return callback(err)
                  message.group = group
                  return callback(null, group)
                }
              )
            } else {
              return callback(null, group)
            }
          })
        }
      ],
      handleTicketType: function (callback) {
        // It is `Issue` type in this situation
        ticketTypeSchema.getTypeByName('Issue', function (err, type) {
          if (err) return callback(err)

          message.type = type
          return callback(null, type)
        })
      },
      handlePriority: [
        'handleTicketType',
        function (result, callback) {
          var type = result.handleTicketType

          var firstPriority = _.first(type.priorities)
          if (!_.isUndefined(firstPriority)) {
            return callback(null, firstPriority._id)
          } else {
            return callback('Invalid default priority')
          }
        }
      ],
      handleCreateTicket: [
        'handleGroup',
        'handlePriority',
        function (results, callback) {
          var HistoryItem = {
            action: 'ticket:created',
            description: 'Ticket was created.',
            owner: message.owner._id
          }
          Ticket.create(
            {
              owner: message.owner._id,
              group: message.group._id,
              type: message.type._id,
              status: 0,
              priority: results.handlePriority,
              subject: message.subject,
              issue: message.body,
              history: [HistoryItem],
              subscribers: [message.owner._id] //the originator should be the first subscriber
            },
            function (err, ticket) {
              if (err) {
                winston.warn('Failed to create ticket from email: ' + err)
                return cb(err)
              }

              emitter.emit('ticket:created', {
                socketId: '',
                ticket: ticket
              })

              return callback(null, ticket)
            }
          )
        }
      ],
      handleUpdateSubject: [
        'handleCreateTicket',
        function (ticket, callback) {
          var subject = message.subject
          subject = '[DISSUE#' + ticket.handleCreateTicket.uid + '] - ' + subject
          //email is from the function parameter, we don't need to do ews bind
          email.SetSubject(subject)
          email.Update(ews.ConflictResolutionMode.AlwaysOverwrite) //2
          return callback(null, ticket)
        }
      ]
    },
    function (err, ticket) {
      if (err) {
        winston.warn(err)
        return null
      }

      if (cb) {
        cb(null, ticket.handleCreateTicket, conversation) // pay attention to it! handleCreateTicket is the true model
      } else {
        res.json({ error: 0, tid: ticket.handleCreateTicket.uid })
      }
    }
  )
}

//Covert conversations into a ticket plus comments, todo
//https://github.com/MicrosoftDocs/office-developer-exchange-docs/blob/master/docs/exchange-web-services/how-to-work-with-conversations-by-using-ews-in-exchange.md
function conversations2Case (res, message) {
  /*
  var propertySet = new ews.PropertySet(ews.BasePropertySet.IdOnly, [
    ews.ItemSchema.Subject,
    ews.ItemSchema.DateTimeReceived
  ])
*/

  var additionalProps = [] // In order to load UniqueBody
  additionalProps.push(ews.ItemSchema.UniqueBody)
  var propertySet = new ews.PropertySet(ews.BasePropertySet.FirstClassProperties, additionalProps)
  // Identify the folders to ignore.

  var folder1 = new ews.FolderId(ews.WellKnownFolderName.DeletedItems)
  var folder2 = new ews.FolderId(ews.WellKnownFolderName.Drafts)
  foldersToIgnore = [folder1, folder2]

  var cid = new ews.ConversationId(message.conversationId)

  // what is the relationships? nodes/itmes? I saw 3 nodes, each contains one email item
  // why the order on item is still not right?
  // Anyway, let us put the items in array, then sort them
  var emails = []
  ewsCheck.exchService
    .GetConversationItems(cid, propertySet, null, foldersToIgnore, ews.ConversationSortOrder.DateOrderAscending) // oldest one on the top
    .then(response => {
      response.ConversationNodes.Items.forEach(node => {
        // Process each item in the conversation node.
        node.Items.forEach(item => {
          emails.push(item)
        })
      })
      //sort it with DateTimeCreated
      emails.sort((a, b) => (a.DateTimeCreated.TotalMilliSeconds > b.DateTimeCreated.TotalMilliSeconds ? 1 : -1))

      if (emails.length == 1) {
        var email = emails[0]
        createTicket(req, res, email, null)
      } else {
        const firstMail = emails.shift() // get the first one and also remove it from the array
        async.waterfall(
          [
            //https://github.com/caolan/async/issues/14
            async.apply(createTicket, req, res, firstMail, emails), // Pass arguments to the first function in waterfall
            function (ticket, items, callback) {
              items.forEach(email => {
                appendEmail(email, ticket)
              })
            }
          ],
          function (err, endTime) {
            // result now equals 'done'
          }
        )
      }
    })
}

function appendEmail (email, ticket) {
  var comment = {
    owner: ticket.owner._id,
    date: new Date(),
    messageId: email.InternetMessageId,
    comment: ewsCheck.toMD(email.UniqueBody)
  }
  //    winston.debug('Creating a comment on ticket %s from mail %s', message.tid, message.folder)
  // if any comment in this ticket contains the message id, then it was generated by comment post in web UI.
  // Unlike API, used by the Portal, we do NOT emit the event 'ticket:comment:added', otherwise it will cause loop
  ticket.comments.push(comment)
  ticket.save(function (err, ticket) {
    // also update email subject with ticket number
  })

  var subject = '[DISSUE#' + ticket.uid + ']-' + email.Subject

  email.SetSubject(subject) // with new subject
  email.Update(ews.ConflictResolutionMode.AlwaysOverwrite) //sounds like it doesn't work in Sent Items
}

//Add the email as a comment of a ticker, todo
function email2Comment (message) {
  Ticket.getSimpleTicketByUid(message.tid, function (err, ticket) {
    if (err) {
      // todo define error code list, also i18n
      res.json({ error: 101, message: 'cannot find the ticket' }) // todo does err contain something
    } else {
      if (ticket === null) {
        res.json({ error: 101, message: 'cannot find the ticket' })
      } else {
        var additionalProps = [] // In order to load UniqueBody
        additionalProps.push(ews.ItemSchema.UniqueBody)
        var propertySet = new ews.PropertySet(ews.BasePropertySet.FirstClassProperties, additionalProps)
        ews.EmailMessage.Bind(ewsCheck.exchService, new ews.ItemId(message.itemId), propertySet).then(function (email) {
          appendEmail(email, ticket)
          res.json({ error: 0 })
        })
      }
    }
  })
}

var apiMails = {}

apiMails.get = function (req, res) {
  var limit = 10
  if (!_.isUndefined(req.query.limit)) {
    try {
      limit = parseInt(req.query.limit)
    } catch (err) {
      limit = 10
    }
  }

  var page = 0
  if (req.query.page) {
    try {
      page = parseInt(req.query.page)
    } catch (err) {
      page = 0
    }
  }

  var obj = {
    limit: limit,
    page: page
  }

  var startDate = ews.DateTime.Now
  startDate = startDate.AddDays(-28) // 1 week
  //      var startDate = new ews.DateTime(2021, 6, 6)
  var greaterThanfilter = new ews.SearchFilter.IsGreaterThanOrEqualTo(
    ews.EmailMessageSchema.DateTimeReceived,
    startDate
  )

  //  var endDate = new ews.DateTime(endTime.valueOf())
  //  var lessThanfilter = new ews.SearchFilter.IsLessThan(ews.EmailMessageSchema.DateTimeReceived, endDate)
  //  var filter = new ews.SearchFilter.SearchFilterCollection(ews.LogicalOperator.And, [greaterThanfilter, lessThanfilter])

  const view = new ews.ItemView(50) // big enough
  ewsCheck.exchService.FindItems(ews.WellKnownFolderName.Inbox, greaterThanfilter, view).then(
    function (response) {
      winston.debug('Processing %s Mail in Inbox', response.TotalCount)
      var results = []
      for (const item of response.items) {
        var message = {}
        message._id = item.Id.UniqueId
        message.from = item.From.Address
        message.subject = item.Subject
        //      received time and size?
        results.push(message)
      }
      return apiUtils.sendApiSuccess(res, { count: results.length, mails: results })
    },
    function (err) {
      // do something with error
      if (err) return apiUtils.sendApiError(res, 400, err.message)
    }
  )
}

apiMails.conduct = function (req, res) {
  var message = req.body
  if (!message) return apiUtils.sendApiError_InvalidPostData(res)

  switch (message.action) {
    case 'delete':
      //can we use null for the last two parameters?
      ewsCheck.exchService
        .DeleteItem(
          new ews.ItemId(message.itemId),
          ews.DeleteMode.MoveToDeletedItems,
          ews.SendCancellationsMode.SendToNone,
          ews.AffectedTaskOccurrence.SpecifiedOccurrenceOnly
        )
        .then(function () {
          res.json({ error: 0 })
        })
      break
    case 'conversation':
      conversations2Case(message)
      break
    case 'comment':
      email2Comment(message)
      break
    case 'read':
      var additionalProps = [] // In order to load UniqueBody
      additionalProps.push(ews.ItemSchema.UniqueBody)
      var propertySet = new ews.PropertySet(ews.BasePropertySet.FirstClassProperties, additionalProps)
      ews.EmailMessage.Bind(ewsCheck.exchService, new ews.ItemId(message.itemId), propertySet).then(function (email) {
        res.json({ error: 0, body: email.Body.Text })
      })
      break
    case 'case':
      var additionalProps = [] // In order to load UniqueBody
      additionalProps.push(ews.ItemSchema.UniqueBody)
      var propertySet = new ews.PropertySet(ews.BasePropertySet.FirstClassProperties, additionalProps)
      ews.EmailMessage.Bind(ewsCheck.exchService, new ews.ItemId(message.itemId), propertySet).then(function (email) {
        createTicket(req, res, email, null)
      })
      break
    default:
  }
}

apiMails.create = function (req, res) {
  var postData = req.body
  if (!postData) return apiUtils.sendApiError_InvalidPostData(res)

  Team.create(postData, function (err, team) {
    if (err) return apiUtils.sendApiError(res, 500, err.message)

    team.populate('members', function (err, team) {
      if (err) return apiUtils.sendApiError(res, 500, err.message)

      return apiUtils.sendApiSuccess(res, { team: team })
    })
  })
}

apiMails.update = function (req, res) {
  var id = req.params.id
  if (!id) return apiUtils.sendApiError(res, 400, 'Invalid Team Id')

  var putData = req.body
  if (!putData) return apiUtils.sendApiError_InvalidPostData(res)

  Team.findOne({ _id: id }, function (err, team) {
    if (err || !team) return apiUtils.sendApiError(res, 400, 'Invalid Team')

    if (putData.name) team.name = putData.name
    if (putData.members) team.members = putData.members

    team.save(function (err, team) {
      if (err) return apiUtils.sendApiError(res, 500, err.message)

      team.populate('members', function (err, team) {
        if (err) return apiUtils.sendApiError(res, 500, err.message)

        return apiUtils.sendApiSuccess(res, { team: team })
      })
    })
  })
}

apiMails.delete = function (req, res) {
  var id = req.params.id
  if (!id) return apiUtils.sendApiError(res, 400, 'Invalid Team Id')

  Team.deleteOne({ _id: id }, function (err, success) {
    if (err) return apiUtils.sendApiError(res, 500, err.message)
    if (!success) return apiUtils.sendApiError(res, 500, 'Unable to delete team. Contact your administrator.')

    return apiUtils.sendApiSuccess(res, { _id: id })
  })
}

module.exports = apiMails
