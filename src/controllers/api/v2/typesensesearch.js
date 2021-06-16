/*
 *       .                             .o8                     oooo
 *    .o8                             "888                     `888
 *  .o888oo oooo d8b oooo  oooo   .oooo888   .ooooo.   .oooo.o  888  oooo
 *    888   `888""8P `888  `888  d88' `888  d88' `88b d88(  "8  888 .8P'
 *    888    888      888   888  888   888  888ooo888 `"Y88b.   888888.
 *    888 .  888      888   888  888   888  888    .o o.  )88b  888 `88b.
 *    "888" d888b     `V88V"V8P' `Y8bod88P" `Y8bod8P' 8""888P' o888o o888o
 *  ========================================================================
 *  Author:     Omnine
 *  Updated:    6/14/21 2:32 AM
 *  Copyright (c) 2014-2019. All rights reserved.
 */

var _ = require('lodash')
var async = require('async')
var ts = require('../../../typesensesearch')
var ticketSchema = require('../../../models/ticket')
var groupSchema = require('../../../models/group')

var apiTypesenseSearch = {}
var apiUtil = require('../apiUtils')

apiTypesenseSearch.rebuild = function (req, res) {
  ts.rebuildIndex()

  return res.json({ success: true })
}

apiTypesenseSearch.status = function (req, res) {
  var response = {}

  async.parallel(
    [
      function (done) {
        ts.checkConnection(function (err, data) {
          if (err) return done(err)
          return done()
        })
      },
      function (done) {
        ts.getIndexCount(function (err, data) {
          if (err) return done(err)
          response.indexCount = !_.isUndefined(data.count) ? data.count : 0
          return done()
        })
      },
      function (done) {
        ticketSchema.getCount(function (err, count) {
          if (err) return done(err)
          response.dbCount = count
          return done()
        })
      }
    ],
    function (err) {
      if (err) return res.status(500).json({ success: false, error: err })

      response.tsStatus = global.tsStatus
      response.isRebuilding = global.esRebuilding === true
      response.inSync = response.dbCount === response.indexCount

      res.json({ success: true, status: response })
    }
  )
}

apiTypesenseSearch.search = function (req, res) {
  var limit = !_.isUndefined(req.query['limit']) ? req.query.limit : 100
  try {
    limit = parseInt(limit)
  } catch (e) {
    limit = 100
  }

  async.waterfall(
    [
      function (next) {
        if (!req.user.role.isAdmin && !req.user.role.isAgent)
          return groupSchema.getAllGroupsOfUserNoPopulate(req.user._id, next)

        var Department = require('../../../models/department')
        return Department.getDepartmentGroupsOfUser(req.user._id, next)
      },
      function (groups, next) {
        var g = _.map(groups, function (i) {
          return i._id
        })

        //Please check the counterpart in elasticsearch, we may need others,
        var obj = {
          q: req.query['q'],
          limit_hits: req.query['limit'],
          query_by: 'subject,issue,comments,notes' //by default do search in the 4 fields.
          //          'query_by_weights': '1,1,1,1',
          //          'sort_by': '_text_match:desc'
        }

        return next(null, obj)
      }
    ],
    function (err, obj) {
      if (err) return apiUtil.sendApiError(res, 500, err.message)
      if (!es || !ts.tsclient) return apiUtil.sendApiError(res, 400, 'TypeSenseSearch is not configured')

      ts.tsclient.search(obj).then(function (r) {
        return res.send(r)
        //see the sample result at https://typesense.org/docs/0.20.0/guide/building-a-search-application.html#searching-for-books
      })
    }
  )
}

module.exports = apiTypesenseSearch
