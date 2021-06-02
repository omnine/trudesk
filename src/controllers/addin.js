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
var fs = require('fs')
var path = require('path')
var jwt = require('jsonwebtoken')
var permissions = require('../permissions')
var Team = require('../models/team')
var userSchema = require('../models/user')
var apiUtils = require('./api/apiUtils')

var addinController = {}

//Post, create a case just link in mailCheck.js
addinController.email2Case = function (req, res) {
  //
  var message = req.body

  async.waterfall(
    [
      function (cb) {
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

            res.json({ target: '/tickets/' + ticket.uid })
            cb(null, ticket)
          }
        )
      },
      function (ticket, cb) {
        let subject = message.subject
        subject = '[DISSUE#' + ticket.uid + ']-' + subject

        var ews = require('ews-javascript-api')
        //create ExchangeService object
        var exch = new ews.ExchangeService(ews.ExchangeVersion.Exchange2013)
        exch.Credentials = new ews.WebCredentials('userName', 'password')
        //set ews endpoint url to use
        exch.Url = new ews.Uri('https://outlook.office365.com/Ews/Exchange.asmx') // you can also use exch.AutodiscoverUrl

        ews.EmailMessage.bind(exch, message.itemId).then(function (email) {
          email.SetSubject(subject)
          email.update(ConflictResolutionMode.AlwaysOverwrite)
        })
      }
    ],
    function (err) {
      if (err) return res.status(400).json({ error: err })
    }
  )
}

module.exports = addinController
