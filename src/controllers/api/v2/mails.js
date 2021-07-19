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

var Team = require('../../../models/team')
var apiUtils = require('../apiUtils')
var ewsCheck = require('../../../mailer/ewsCheck')

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
  startDate = startDate.AddDays(-7) // 1 week
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

apiMails.read = function (req, res) {
  var message = req.body
  if (!message) return apiUtils.sendApiError_InvalidPostData(res)
  var propertySet = new ews.PropertySet(ews.ItemSchema.Body)
  ews.EmailMessage.Bind(ewsCheck.exchService, new ews.ItemId(message.itemId), propertySet).then(function (email) {
    createTicket(email, null)
    res.json({ error: 0, body: email.Body.Text })
  })
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
