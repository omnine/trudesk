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
          query_by: 'subject,issue,comments,notes' //by default do search in the 4 fields. According to the doc, The order of the fields is important
          //          'query_by_weights': '1,1,1,1',
          //          'sort_by': '_text_match:desc'
        }

        return next(null, obj)
      }
    ],
    function (err, obj) {
      if (err) return apiUtil.sendApiError(res, 500, err.message)
      if (!ts || !ts.tsclient) return apiUtil.sendApiError(res, 400, 'TypeSenseSearch is not configured')

      ts.tsclient
        .collections(ts.indexName)
        .documents()
        .search(obj)
        .then(function (r) {
          return res.send(r)
          //see the sample result at https://typesense.org/docs/0.20.0/guide/building-a-search-application.html#searching-for-books
        })
    }
  )
}

module.exports = apiTypesenseSearch
