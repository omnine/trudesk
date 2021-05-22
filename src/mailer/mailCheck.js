/*
 *       .                             .o8                     oooo
 *    .o8                             "888                     `888
 *  .o888oo oooo d8b oooo  oooo   .oooo888   .ooooo.   .oooo.o  888  oooo
 *    888   `888""8P `888  `888  d88' `888  d88' `88b d88(  "8  888 .8P'
 *    888    888      888   888  888   888  888ooo888 `"Y88b.   888888.
 *    888 .  888      888   888  888   888  888    .o o.  )88b  888 `88b.
 *    "888" d888b     `V88V"V8P' `Y8bod88P" `Y8bod8P' 8""888P' o888o o888o
 *  ========================================================================
 *  Author:     Chris Brame
 *  Updated:    1/20/19 4:43 PM
 *  Copyright (c) 2014-2019. All rights reserved.
 */

var _ = require('lodash')
var async = require('async')
var Imap = require('imap')
var winston = require('winston')
// var marked      = require('marked');
var simpleParser = require('mailparser').simpleParser
var cheerio = require('cheerio')
var mimemessage = require('mimemessage')

var emitter = require('../emitter')
var userSchema = require('../models/user')
var groupSchema = require('../models/group')
var ticketTypeSchema = require('../models/tickettype')
var Ticket = require('../models/ticket')

var mailCheck = {}
mailCheck.inbox = []

mailCheck.init = function (settings) {
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

  mailCheck.Imap = new Imap({
    user: MAILERCHECK_USER,
    password: MAILERCHECK_PASS,
    host: MAILERCHECK_HOST,
    port: MAILERCHECK_PORT,
    tls: MAILERCHECK_TLS
  })

  mailCheck.fetchMailOptions = {
    defaultTicketType: s.mailerCheckTicketType.value,
    defaultPriority: s.mailerCheckTicketPriority.value,
    createAccount: s.mailerCheckCreateAccount.value,
    deleteMessage: s.mailerCheckDeleteMessage.value
  }

  mailCheck.messages = []

  bindImapError()
  bindImapReady()

  mailCheck.fetchMail()
  mailCheck.checkTimer = setInterval(function () {
    mailCheck.fetchMail()
  }, POLLING_INTERVAL)
}

mailCheck.refetch = function () {
  if (_.isUndefined(mailCheck.fetchMailOptions)) {
    winston.warn('Mailcheck.refetch() running before Mailcheck.init(); please run Mailcheck.init() prior')
    return
  }

  mailCheck.fetchMail()
}

function bindImapError () {
  mailCheck.Imap.on('error', function (err) {
    winston.debug(err)
  })
}

function bindImapReady () {
  try {
    mailCheck.Imap.on('end', function () {
      handleMessages(mailCheck.messages, function () {
        mailCheck.Imap.destroy()
      })
    })

    mailCheck.Imap.on('ready', function () {
      // Runs the tasks array of functions in series
      async.waterfall([openSentFolder, openInboxFolder], function (err, result) {
        // result now equals 'done'
      })
    })
  } catch (error) {
    winston.warn(error)
    mailCheck.Imap.end()
  }
}

mailCheck.fetchMail = function () {
  try {
    mailCheck.messages = []
    mailCheck.Imap.connect()
  } catch (err) {
    mailCheck.Imap.end()
    winston.warn(err)
  }
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
              if (mailCheck.fetchMailOptions.createAccount) {
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
            if (mailCheck.fetchMailOptions.defaultTicketType === 'Issue') {
              ticketTypeSchema.getTypeByName('Issue', function (err, type) {
                if (err) return callback(err)

                mailCheck.fetchMailOptions.defaultTicketType = type._id
                message.type = type

                return callback(null, type)
              })
            } else {
              ticketTypeSchema.getType(mailCheck.fetchMailOptions.defaultTicketType, function (err, type) {
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

              if (mailCheck.fetchMailOptions.defaultPriority !== '') {
                return callback(null, mailCheck.fetchMailOptions.defaultPriority)
              }

              var firstPriority = _.first(type.priorities)
              if (!_.isUndefined(firstPriority)) {
                mailCheck.fetchMailOptions.defaultPriority = firstPriority._id
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
  mailCheck.Imap.openBox('INBOX', function (err) {
    if (err) {
      mailCheck.Imap.end()
      winston.debug(err)
    } else {
      async.waterfall(
        [
          function (next) {
            mailCheck.Imap.search(['UNSEEN'], next)
          },
          function (results, next) {
            if (_.size(results) < 1) {
              winston.debug('MailCheck: Nothing to Fetch.')
              return next()
            }

            winston.debug('Processing %s Mail', _.size(results))

            var flag = '\\Seen'
            if (mailCheck.fetchMailOptions.deleteMessage) {
              flag = '\\Deleted'
            }

            var message = {}

            var f = mailCheck.Imap.fetch(results, {
              bodies: ''
            })

            f.on('message', function (msg) {
              msg.on('body', function (stream) {
                var buffer = ''
                stream.on('data', function (chunk) {
                  buffer += chunk.toString('utf8')
                })

                stream.once('end', function () {
                  simpleParser(buffer, function (err, mail) {
                    if (err) winston.warn(err)

                    if (mail.headers.has('from')) {
                      message.from = mail.headers.get('from').value[0].address
                    }

                    if (mail.subject) {
                      message.subject = mail.subject
                    } else {
                      message.subject = message.from
                    }

                    if (_.isUndefined(mail.textAsHtml)) {
                      var $ = cheerio.load(mail.html)
                      var $body = $('body')
                      message.body = $body.length > 0 ? $body.html() : mail.html
                    } else {
                      message.body = mail.textAsHtml
                    }
                    message.folder = 'INBOX'
                    mailCheck.messages.push(message)
                  })
                })
              })
            })

            f.on('end', function () {
              async.series(
                [
                  function (cb) {
                    mailCheck.Imap.addFlags(results, flag, cb)
                  },
                  function (cb) {
                    mailCheck.Imap.closeBox(true, cb)
                  }
                ],
                function (err) {
                  if (err) winston.warn(err)
                  return next()
                }
              )
            })
          }
        ],
        function (err) {
          if (err) winston.warn(err)
          mailCheck.Imap.end()
          callback(null)
        }
      )
    }
  })
}

// todo  'Sent Items'  # Exchange (probably outlook) default sent folder, other email server may have a different name
/*
How to avoid such a case,  
1, as a agent, post a comment, it will trigger a smtp to send a email to the client, 
it also appends the email in to Sent folder.
2, now start fetchSent job, which will add the reply done by agent who uses email client to do a reply.
3, obviously we have to filter out the email generated in step 1.

We should check if the message-id has been in the database already
*/
function openSentFolder (callback) {
  //  mailCheck.Imap.openBox('Sent Items', cb)

  mailCheck.Imap.openBox('Sent Items', function (err) {
    if (err) {
      mailCheck.Imap.end()
      winston.debug(err)
    } else {
      async.waterfall(
        [
          function (next) {
            // alternatively mailCheck.Imap.sort(['DATE'], [searchCriteria], next), where to save the lastcheck?
            var settingUtil = require('../settings/settingsUtil')
            var curTime = new Date()

            var settingSchema = require('../models/setting')
            settingSchema.getSetting('mailer:check:last_fetch', function (err, setting) {
              if (!err && setting && setting.value) {
                last_fetch = setting.value
              } else {
                last_fetch = new Date()
                last_fetch.setDate(curTime.getDate() - 2)
              }

              settingUtil.setSetting('mailer:check:last_fetch', curTime, function (err) {
                mailCheck.Imap.search([['SINCE', last_fetch], ['BEFORE', curTime]], next)
              })
            })
          },
          function (results, next) {
            if (_.size(results) < 1) {
              winston.debug('MailCheck: Nothing to Fetch in SENT Folder.')
              return next()
            }

            winston.debug('Processing %s Mail in SENT Folder', _.size(results))
            // copy other code?

            var message = {}

            var f = mailCheck.Imap.fetch(results, {
              bodies: ''
            })

            f.on('message', function (msg) {
              msg.on('body', function (stream) {
                var buffer = ''
                stream.on('data', function (chunk) {
                  buffer += chunk.toString('utf8')
                })

                stream.once('end', function () {
                  simpleParser(buffer, function (err, mail) {
                    if (err) winston.warn(err)

                    if (mail.headers.has('from')) {
                      message.from = mail.headers.get('from').value[0].address
                    }

                    if (mail.subject) {
                      winston.debug('parse email 1: %s', mail.subject)
                      message.subject = mail.subject
                    } else {
                      message.subject = message.from
                      winston.debug('parse email 2: %s', mail.from)
                    }

                    if (_.isUndefined(mail.textAsHtml)) {
                      var $ = cheerio.load(mail.html)
                      var $body = $('body')
                      message.body = $body.length > 0 ? $body.html() : mail.html
                    } else {
                      message.body = mail.textAsHtml
                    }
                    message.messageId = mail.messageId // used to check if this mesage correspond to the comment done in trudesk web portal.
                    message.folder = 'SENT'
                    mailCheck.messages.push(message)
                  })
                })
              })
            })

            f.on('end', function () {
              async.series(
                [
                  function (cb) {
                    mailCheck.Imap.closeBox(true, cb)
                  }
                ],
                function (err) {
                  if (err) winston.warn(err)
                  return next()
                }
              )
            })
          }
        ],
        function (err) {
          if (err) winston.warn(err)
          mailCheck.Imap.end()
          callback(null)
        }
      )
    }
  })
}

// https://stackoverflow.com/questions/49807855/node-imap-sending-emails-but-not-saving-it-to-sent
// https://github.com/nodemailer/nodemailer/issues/1032

function appendIntoSentFolder (mailOptions, messageId) {
  let msg, htmlEntity, plainEntity
  //https://github.com/eface2face/mimemessage.js
  msg = mimemessage.factory({
    contentType: 'multipart/alternate',
    body: []
  })
  htmlEntity = mimemessage.factory({
    contentType: 'text/html;charset=utf-8',
    body: mailOptions.html
  })
  plainEntity = mimemessage.factory({
    body: mailOptions.text
  })
  msg.header('Message-ID', messageId)
  msg.header('From', mailOptions.from)
  msg.header('To', mailOptions.to)
  msg.header('Subject', mailOptions.subject)
  msg.header('Date', new Date())
  //msg.body.push(htmlEntity);
  msg.body.push(plainEntity)

  //  imap.append(msg.toString())
  //mailOptions.html
  mailCheck.Imap.append(
    msg.toString(),
    { mailbox: 'Sent Items', flags: ['Seen'], date: new Date(Date.now()) },
    function (err) {
      if (err) throw err
      imap.end()
    }
  )
}

module.exports = mailCheck
