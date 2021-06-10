/*
 *       .                             .o8                     oooo
 *    .o8                             "888                     `888
 *  .o888oo oooo d8b oooo  oooo   .oooo888   .ooooo.   .oooo.o  888  oooo
 *    888   `888""8P `888  `888  d88' `888  d88' `88b d88(  "8  888 .8P'
 *    888    888      888   888  888   888  888ooo888 `"Y88b.   888888.
 *    888 .  888      888   888  888   888  888    .o o.  )88b  888 `88b.
 *    "888" d888b     `V88V"V8P' `Y8bod88P" `Y8bod8P' 8""888P' o888o o888o
 *  ========================================================================
 *  Author:     Omnine Nanoart
 *  Updated:    1/20/19 4:43 PM
 *  Copyright (c) 2014-2019. All rights reserved.
 *  Use EWS to check email on Exchange server
 */

var _ = require('lodash')
var async = require('async')
var winston = require('winston')
// var marked      = require('marked');
//var cheerio = require('cheerio')

var emitter = require('../emitter')
var userSchema = require('../models/user')
var groupSchema = require('../models/group')
var ticketTypeSchema = require('../models/tickettype')
var Ticket = require('../models/ticket')

var ews = require('ews-javascript-api')

var ewsCheck = {}
ewsCheck.inbox = []

ewsCheck.init = function (settings) {
  var s = {}
  s.mailerCheckEnabled = _.find(settings, function (x) {
    return x.name === 'mailer:check:enable'
  })
  s.mailerCheckHost = _.find(settings, function (x) {
    return x.name === 'mailer:check:host'
  })
  s.mailerCheckPort = _.find(settings, function (x) {
    return x.name === 'mailer:check:port'
  })
  s.mailerCheckUsername = _.find(settings, function (x) {
    return x.name === 'mailer:check:username'
  })
  s.mailerCheckPassword = _.find(settings, function (x) {
    return x.name === 'mailer:check:password'
  })
  s.mailerCheckPolling = _.find(settings, function (x) {
    return x.name === 'mailer:check:polling'
  })
  s.mailerCheckTicketType = _.find(settings, function (x) {
    return x.name === 'mailer:check:ticketype'
  })
  s.mailerCheckTicketPriority = _.find(settings, function (x) {
    return x.name === 'mailer:check:ticketpriority'
  })
  s.mailerCheckCreateAccount = _.find(settings, function (x) {
    return x.name === 'mailer:check:createaccount'
  })
  s.mailerCheckDeleteMessage = _.find(settings, function (x) {
    return x.name === 'mailer:check:deletemessage'
  })

  s.mailerCheckEnabled = s.mailerCheckEnabled === undefined ? { value: false } : s.mailerCheckEnabled
  s.mailerCheckHost = s.mailerCheckHost === undefined ? { value: '' } : s.mailerCheckHost
  s.mailerCheckPort = s.mailerCheckPort === undefined ? { value: 143 } : s.mailerCheckPort
  s.mailerCheckUsername = s.mailerCheckUsername === undefined ? { value: '' } : s.mailerCheckUsername
  s.mailerCheckPassword = s.mailerCheckPassword === undefined ? { value: '' } : s.mailerCheckPassword
  s.mailerCheckPolling = s.mailerCheckPolling === undefined ? { value: 600000 } : s.mailerCheckPolling // 10 min
  s.mailerCheckTicketType = s.mailerCheckTicketType === undefined ? { value: 'Issue' } : s.mailerCheckTicketType
  s.mailerCheckTicketPriority = s.mailerCheckTicketPriority === undefined ? { value: '' } : s.mailerCheckTicketPriority
  s.mailerCheckCreateAccount = s.mailerCheckCreateAccount === undefined ? { value: false } : s.mailerCheckCreateAccount
  s.mailerCheckDeleteMessage = s.mailerCheckDeleteMessage === undefined ? { value: false } : s.mailerCheckDeleteMessage

  var MAILERCHECK_ENABLED = s.mailerCheckEnabled.value
  var MAILERCHECK_HOST = s.mailerCheckHost.value
  var MAILERCHECK_USER = s.mailerCheckUsername.value
  var MAILERCHECK_PASS = s.mailerCheckPassword.value
  var MAILERCHECK_PORT = s.mailerCheckPort.value
  var MAILERCHECK_TLS = s.mailerCheckPort.value === '993'
  var POLLING_INTERVAL = s.mailerCheckPolling.value

  if (!MAILERCHECK_ENABLED) return true

  ewsCheck.fetchMailOptions = {
    defaultTicketType: s.mailerCheckTicketType.value,
    defaultPriority: s.mailerCheckTicketPriority.value,
    createAccount: s.mailerCheckCreateAccount.value,
    deleteMessage: s.mailerCheckDeleteMessage.value
  }

  ewsCheck.messages = []

  bindEWSReady()

  ewsCheck.checkTimer = setInterval(function () {
    ewsCheck.fetchMail()
  }, POLLING_INTERVAL)
}

ewsCheck.refetch = function () {
  /*
  if (_.isUndefined(ewsCheck.fetchMailOptions)) {
    winston.warn('Mailcheck.refetch() running before Mailcheck.init(); please run Mailcheck.init() prior')
    return
  }
*/
  ewsCheck.fetchMail()
}

function bindEWSReady () {
  var settingsUtil = require('../settings/settingsUtil')
  settingsUtil.getSettings(function (err, s) {
    if (err) return cb(err)
    var settings = s.data.settings

    //create ExchangeService object
    // todo read the credentials from settings or nconf
    var exch = new ews.ExchangeService(ews.ExchangeVersion.Exchange2016)
    exch.Credentials = new ews.ExchangeCredentials(settings.ewsUsername.value, settings.ewsPassword.value)
    //set ews endpoint url to use
    exch.Url = new ews.Uri(settings.ewsUrl.value) // you can also use exch.AutodiscoverUrl, 'https://outlook.office365.com/Ews/Exchange.asmx'
    var ewsAuth = require('@ewsjs/xhr') // for NTLM auth
    const xhr = new ewsAuth.XhrApi({ rejectUnauthorized: false, gzip: true }).useNtlmAuthentication(
      settings.ewsUsername.value,
      settings.ewsPassword.value
    )
    exch.XHRApi = xhr
    ewsCheck.exchService = exch
    //    ewsCheck.fetchMail()
  })
}

ewsCheck.fetchMail = function () {
  // Runs the tasks array of functions in series
  async.waterfall([openSentFolder, openInboxFolder], function (err, result) {
    // result now equals 'done'
  })
}

function handleMessages (messages, done) {
  var count = 0
  messages.forEach(function (message) {
    if (
      !_.isUndefined(message.from) &&
      !_.isEmpty(message.from) &&
      !_.isUndefined(message.subject) &&
      !_.isEmpty(message.subject) &&
      !_.isUndefined(message.body) &&
      !_.isEmpty(message.body)
    ) {
      async.auto(
        {
          handleUser: function (callback) {
            userSchema.getUserByEmail(message.from, function (err, user) {
              if (err) winston.warn(err)
              if (!err && user) {
                message.owner = user
                return callback(null, user)
              }

              // User doesn't exist. Lets create public user... If we want too
              if (ewsCheck.fetchMailOptions.createAccount) {
                userSchema.createUserFromEmail(message.from, function (err, response) {
                  if (err) return callback(err)

                  message.owner = response.user
                  message.group = response.group

                  return callback(null, response)
                })
              } else {
                return callback('No User found.')
              }
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
            if (ewsCheck.fetchMailOptions.defaultTicketType === 'Issue') {
              ticketTypeSchema.getTypeByName('Issue', function (err, type) {
                if (err) return callback(err)

                ewsCheck.fetchMailOptions.defaultTicketType = type._id
                message.type = type

                return callback(null, type)
              })
            } else {
              ticketTypeSchema.getType(ewsCheck.fetchMailOptions.defaultTicketType, function (err, type) {
                if (err) return callback(err)

                message.type = type

                return callback(null, type)
              })
            }
          },
          handlePriority: [
            'handleTicketType',
            function (result, callback) {
              var type = result.handleTicketType

              if (ewsCheck.fetchMailOptions.defaultPriority !== '') {
                return callback(null, ewsCheck.fetchMailOptions.defaultPriority)
              }

              var firstPriority = _.first(type.priorities)
              if (!_.isUndefined(firstPriority)) {
                ewsCheck.fetchMailOptions.defaultPriority = firstPriority._id
              } else {
                return callback('Invalid default priority')
              }

              return callback(null, firstPriority._id)
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
              // check if the message is already in the ticket
              var startIndex = message.subject.indexOf('[DISSUE#')
              if (startIndex >= 0) {
                startIndex = startIndex + 8
                endIndex = message.subject.indexOf(']', startIndex)
                if (endIndex > startIndex) {
                  var tid = message.subject.substring(startIndex, endIndex)
                  Ticket.getSimpleTicketByUid(tid, function (err, ticket) {
                    var need = true
                    for (comment in ticket.comments) {
                      if (comment.messageId === message.messageId) {
                        need = false
                        break
                      }
                    }

                    if (need) {
                      var comment = {
                        owner: message.owner._id,
                        date: new Date(),
                        // https://stackoverflow.com/questions/7978987/get-the-actual-email-message-that-the-person-just-wrote-excluding-any-quoted-te/12611562#12611562
                        comment: message.body // todo sounds like it is very hard, we can focus on MS Exchange perhaps.
                      }
                      winston.debug('Creating a comment on ticket %s from mail %s', tid, message.folder)
                      // if any comment in this ticket contains the message id, then it was genrated by comment post in web UI.
                      ticket.comments.push(comment)
                      ticket.save(function (err, ticket) {
                        return callback()
                      })
                    }
                  })
                  return // will not do Ticket.create
                }
              }

              if (message.folder === 'SENT') return

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
                    return callback(err)
                  }

                  emitter.emit('ticket:created', {
                    socketId: '',
                    ticket: ticket
                  })

                  count++
                  return callback()
                }
              )
            }
          ]
        },
        function (err) {
          winston.debug('Created %s tickets from mail', count)
          if (err) winston.warn(err)
          return done(err)
        }
      )
    }
  })
}

function openInboxFolder (callback) {
  const view = new ews.ItemView(50) // big enough
  //here we only check Unread email in Inbox, if it is Read, people may have processed in Outlook Add-in
  ewsCheck.exchService.FindItems(ews.WellKnownFolderName.Inbox, 'isRead:false', view).then(
    function (response) {
      if (response.TotalCount < 1) {
        winston.debug('MailCheck through EWS: Nothing to Fetch from INBOX.')
        return callback(null)
      }
      winston.debug('Processing %s Mail', response.TotalCount)
      for (const item of response.items) {
        item.Load().then(function () {
          var message = {}
          message.from = item.From.Address
          message.subject = item.Subject

          message.body = item.Body.Text
          message.folder = 'INBOX'
          ewsCheck.messages.push(message)
        })
        item.IsRead = true
        item.Update(ConflictResolutionMode.AutoResolve)
      }
      return callback(null)
    },
    function (err) {
      // do something with error
      winston.debug('MailCheck through EWS: Failed on FindItems')
      return callback(err)
    }
  )
}

/*
How to avoid such a case,  
1, as a agent, post a comment, it will trigger a smtp to send a email to the client, 
it also appends the email in to Sent folder.
2, now start fetchSent job, which will add the reply done by agent who uses email client to do a reply.
3, obviously we have to filter out the email generated in step 1.

We should check if the message-id has been in the database already
*/
function openSentFolder (callback) {
  var settingUtil = require('../settings/settingsUtil')
  var curTime = new Date()
  // last_fetch is the type javascript Date, which mongodb supports, it is originally used in node-imap
  var settingSchema = require('../models/setting')
  settingSchema.getSetting('mailer:check:last_fetch', function (err, setting) {
    if (!err && setting && setting.value) {
      last_fetch = setting.value
    } else {
      last_fetch = new Date()
      last_fetch.setDate(curTime.getDate() - 2)
    }

    settingUtil.setSetting('mailer:check:last_fetch', curTime, function (err) {
      winston.debug('Checking emails in SENT folder since %s', last_fetch.toString())
      var startDate = new ews.DateTime(last_fetch.valueOf()) // convert to the format ews needed.
      //      var startDate = new ews.DateTime(2021, 6, 6)
      var greaterThanfilter = new ews.SearchFilter.IsGreaterThanOrEqualTo(
        ews.EmailMessageSchema.DateTimeSent,
        startDate
      )

      view = new ews.ItemView(100)
      ewsCheck.exchService.FindItems(ews.WellKnownFolderName.SentItems, greaterThanfilter, view).then(
        function (response) {
          if (response.TotalCount < 1) {
            winston.debug('MailCheck with EWS: Nothing to Fetch in SENT Folder.')
            return callback(null)
          }

          winston.debug('Processing %d Mail(s) in SENT Folder', response.TotalCount)
          var message = {}
          for (const item of response.items) {
            item.Load().then(function () {
              var message = {}
              message.from = item.From.Address
              message.subject = item.Subject
              message.body = toMD(item.Body) // item.Body.Text
              //use this one
              message.inReplyTo = item.inReplyTo
              //                message.references = item.References
              message.folder = 'SENT'
              ewsCheck.messages.push(message)
            })
          }
          return callback(null)
        },
        function (error) {
          return callback(error)
        }
      )
    })
  })
}

// use cheerio? just like in mailCheck.js?
function toMD (messageBody) {
  if (messageBody.BodyType == ews.BodyType.HTML) {
    // For Node.js
    var TurndownService = require('turndown')

    var turndownService = new TurndownService()
    var markdown = turndownService.turndown(messageBody.Text)
    return markdown
  } else {
    return messageBody.Text
  }
}

// use the same data format as nodemailer
ewsCheck.sendEWSMail = function (data, callback) {
  const message = new ews.EmailMessage(ewsCheck.exchService)
  message.Subject = data.subject

  var escapeHtml = require('escape-html')
  message.Body = new ews.MessageBody(ews.BodyType.HTML, escapeHtml(data.html))
  message.ToRecipients.Add(data.to)

  var uuid = require('uuid')
  var extID = 'omnine.' + uuid.v4() + '@deepnetsecurity.com' // NO < and > otherwise  The request failed schema validation
  var PidTagInternetMessageId = new ews.ExtendedPropertyDefinition(4149, ews.MapiPropertyType.String)
  message.SetExtendedProperty(PidTagInternetMessageId, extID)

  message.SendAndSaveCopy()
}

module.exports = ewsCheck
