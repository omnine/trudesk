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
var permissions = require('../permissions')
var Team = require('../models/team')

var mailController = {}

mailController.get = function (req, res) {
  var user = req.user
  if (_.isUndefined(user) || !permissions.canThis(user.role, 'teams:view')) {
    return res.redirect('/')
  }

  var content = {}
  content.title = 'Mails'
  content.nav = 'mails'

  content.data = {}
  content.data.user = req.user
  content.data.common = req.viewdata
  content.data.teams = {}

  return res.render('owalite', content) //must be one of the views under src/views
}

module.exports = mailController
