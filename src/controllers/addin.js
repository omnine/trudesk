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
var permissions = require('../permissions')
var Team = require('../models/team')

var addinController = {}

addinController.get = function (req, res) {
  var user = req.user
  if (_.isUndefined(user) || !permissions.canThis(user.role, 'teams:view')) {
    return res.redirect('/')
  }

  var content = {}
  content.title = 'Teams'
  content.nav = 'teams'

  content.data = {}
  content.data.user = req.user
  content.data.common = req.viewdata
  content.data.teams = {}

  return res.render('team', content)
}

// get an API token after validation
addinController.validateAgent = function (req, res) {
  //Outlook will get a JWT token from exchange server, we get msexchuid

  //then check database to get API token

  //then render token back as json

  return res.json({ token: '123456' })
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
