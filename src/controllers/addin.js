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

// get an API token after validation
addinController.validateAgent = function (req, res) {
  var settingSchema = require('../models/setting')
  var exToken = req.body.token
  async.waterfall(
    [
      function (cb) {
        settingSchema.getSetting('gen:msex:authcert', function (err, setting) {
          if (!err && setting && setting.value) {
            var cert = setting.value
            cb(null, cert)
          } else {
            return cb(err)
            //            return apiUtils.sendApiError(res, 400, 'NO Exchange Auth Cert')
          }
        })
      },
      function (cert, cb) {
        var file = path.join(__dirname, '../../public/public.pem')
        var publicKey = fs.readFileSync(file)
        jwt.verify(exToken, publicKey, function (err, decoded) {
          if (err) return cb(err)
          winston.debug('msexchuid= %s', decoded.appctx.msexchuid)
          cb(null, decoded.appctx.msexchuid)
          //Outlook will get a JWT token from exchange server, we get msexchuid
          //We should validate the exchange identity token first
          //https://docs.microsoft.com/en-us/office/dev/add-ins/outlook/authenticate-a-user-with-an-identity-token

          //then check database to get API token
        })
      },
      function (msexchuid, cb) {
        //then check database to get API token
        userSchema.findOne({ msexchuid: msexchuid }, function (err, user) {
          if (err || !user) return cb(err)
          //then return api token

          return res.json({ token: user.accessToken })
        })
      }
    ],
    function (err) {
      if (err) return res.status(400).json({ error: err })
    }
  )
}

//Post
addinController.updateSubject = function (req, res) {
  var ews = require('ews-javascript-api')
  //create ExchangeService object
  var exch = new ews.ExchangeService(ews.ExchangeVersion.Exchange2013)
  exch.Credentials = new ews.WebCredentials('userName', 'password')
  //set ews endpoint url to use
  exch.Url = new ews.Uri('https://outlook.office365.com/Ews/Exchange.asmx') // you can also use exch.AutodiscoverUrl

  ews.EmailMessage.bind(exch, req.itemId).then(function (email) {
    email.SetSubject(req.subject)
    email.update(ConflictResolutionMode.AlwaysOverwrite)
  })
}

module.exports = addinController
