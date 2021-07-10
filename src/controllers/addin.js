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
 *  Updated:    1/20/21 4:43 PM
 *  Copyright (c) 2021-2022. All rights reserved.
 */

var _ = require('lodash')
var async = require('async')
var winston = require('winston')
var Ticket = require('../models/ticket')
var emitter = require('../emitter')
var userSchema = require('../models/user')
var groupSchema = require('../models/group')
var ticketTypeSchema = require('../models/tickettype')
var ews = require('ews-javascript-api')
var ewsCheck = require('../mailer/ewsCheck')

var addinController = {}

//Post, create a case just link in mailCheck.js
addinController.email2Case = function (req, res) {
  //
  var message = req.body
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

              res.json({ uid: ticket.uid })
              return callback(null, ticket)
            }
          )
        }
      ],
      handleUpdateSubject: [
        'handleCreateTicket',
        function (ticket, callback) {
          var subject = message.subject
          subject = '[DISSUE#' + ticket.handleCreateTicket.uid + ']-' + subject
          ews.EmailMessage.Bind(ewsCheck.exchService, new ews.ItemId(message.itemId)).then(function (email) {
            email.SetSubject(subject)
            email.Update(ews.ConflictResolutionMode.AlwaysOverwrite) //2
            return callback(null)
          })
        }
      ]
    },
    function (err) {
      if (err) winston.warn(err)
      return done(err)
    }
  )
}

//Covert conversations into a ticket plus comments, todo
//https://github.com/MicrosoftDocs/office-developer-exchange-docs/blob/master/docs/exchange-web-services/how-to-work-with-conversations-by-using-ews-in-exchange.md
addinController.conversations2Case = function (req, res) {
  var message = req.body // Only contain conversationId

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

  ewsCheck.exchService
    .GetConversationItems(cid, propertySet, null, foldersToIgnore, ews.ConversationSortOrder.TreeOrderDescending)
    .then(response => {
      response.ConversationNodes.Items.forEach(node => {
        // Process each item in the conversation node.
        node.Items.forEach(item => {
          var content = ewsCheck.toMD(item.UniqueBody) // convert to markdown, much smaller and easier for indexing
          winston.info('what is it %s', item.Subject)
        })
      })
    })
}

//Add the email as a comment of a ticker, todo
addinController.email2Comment = function (req, res) {
  var message = req.body
  Ticket.getSimpleTicketByUid(message.tid, function (err, ticket) {
    var propertySet = new ews.PropertySet(ews.ItemSchema.UniqueBody)

    ews.EmailMessage.Bind(ewsCheck.exchService, new ews.ItemId(message.itemId), propertySet).then(function (email) {
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
      email.Update(ews.ConflictResolutionMode.AlwaysOverwrite) //2
      res.json({ error: 0 })
    })
  })
}

module.exports = addinController
