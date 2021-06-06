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
 *  Updated:    05/08/21 12:09 AM
 *  Copyright (c) 2014-2019. All rights reserved.
 */

var _ = require('lodash')
var async = require('async')
var winston = require('winston')
var Ticket = require('../models/ticket')
var emitter = require('../emitter')
var userSchema = require('../models/user')
var groupSchema = require('../models/group')
var ticketTypeSchema = require('../models/tickettype')

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
        function (ticket, cb) {
          let subject = message.subject
          subject = '[DISSUE#' + ticket.uid + ']-' + subject

          //getSettings is too much?, otherwise need 3 nested functions
          var settingsUtil = require('../settings/settingsUtil')
          settingsUtil.getSettings(function (err, s) {
            if (err) return cb(err)
            var settings = s.data.settings

            var ews = require('ews-javascript-api')
            //create ExchangeService object
            // todo read the credentials from settings or nconf
            var exch = new ews.ExchangeService(ews.ExchangeVersion.Exchange2013)
            exch.Credentials = new ews.WebCredentials(settings.ewsUsername.value, settings.ewsPassword.value)
            //set ews endpoint url to use
            exch.Url = new ews.Uri(settings.ewsUrl.value) // you can also use exch.AutodiscoverUrl, 'https://outlook.office365.com/Ews/Exchange.asmx'

            ews.EmailMessage.Bind(exch, new ews.ItemId(message.itemId)).then(function (email) {
              email.SetSubject(subject)
              email.update(ConflictResolutionMode.AlwaysOverwrite)
            })
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

module.exports = addinController
