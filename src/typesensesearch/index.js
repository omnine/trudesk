/*
     .                              .o8                     oooo
   .o8                             "888                     `888
 .o888oo oooo d8b oooo  oooo   .oooo888   .ooooo.   .oooo.o  888  oooo
   888   `888""8P `888  `888  d88' `888  d88' `88b d88(  "8  888 .8P'
   888    888      888   888  888   888  888ooo888 `"Y88b.   888888.
   888 .  888      888   888  888   888  888    .o o.  )88b  888 `88b.
   "888" d888b     `V88V"V8P' `Y8bod88P" `Y8bod8P' 8""888P' o888o o888o
 ========================================================================
 Created:    09/08/2018
 Author:     Chris Brame

 **/

var _ = require('lodash')
var path = require('path')
var async = require('async')
var nconf = require('nconf')
var winston = require('winston')

var Typesense = require('typesense')
var emitter = require('../emitter')
var moment = require('moment-timezone')
var settingUtil = require('../settings/settingsUtil')

var TS = {}
TS.indexName = process.env.ELASTICSEARCH_INDEX_NAME || 'trudesk'

function checkConnection (callback) {
  if (!TS.tsclient) return callback('Typesense client not initialized. Restart Trudesk!')

  TS.tsclient.ping(
    {
      requestTimeout: 10000
    },
    function (err) {
      if (err) return callback('Could not connect to Typesense: ' + TS.host)

      return callback()
    }
  )
}

TS.testConnection = function (callback) {
  if (process.env.ELEASTICSEARCH_URI) TS.host = process.env.ELEASTICSEARCH_URI
  else TS.host = nconf.get('typesense:host') + ':' + nconf.get('typesense:port')

  TS.tsclient = new Typesense.Client({
    host: TS.host
  })

  checkConnection(callback)
}

TS.setupHooks = function () {
  var ticketSchema = require('../models/ticket')

  emitter.on('ticket:deleted', function (_id) {
    if (_.isUndefined(_id)) return false

    TS.tsclient
      .collections(TS.indexName)
      .documents(_id.toString())
      .delete()
    //how to handle the error
  })

  emitter.on('ticket:updated', function (data) {
    if (_.isUndefined(data._id)) return

    ticketSchema.getTicketById(data._id.toString(), function (err, ticket) {
      if (err) {
        winston.warn('Elasticsearch Error: ' + err)
        return false
      }

      var cleanedTicket = {
        uid: ticket.uid,
        subject: ticket.subject,
        issue: ticket.issue,
        date: ticket.date,
        owner: ticket.owner,
        assignee: ticket.assignee,
        group: {
          _id: ticket.group._id,
          name: ticket.group.name
        },
        comments: ticket.comments,
        notes: ticket.notes,
        deleted: ticket.deleted,
        priority: {
          _id: ticket.priority._id,
          name: ticket.priority.name,
          htmlColor: ticket.priority.htmlColor
        },
        type: { _id: ticket.type._id, name: ticket.type.name },
        status: ticket.status,
        tags: ticket.tags
      }

      TS.tsclient
        .collections(TS.indexName)
        .documents(ticket._id.toString())
        .update(cleanedTicket)
    })
  })

  emitter.on('ticket:created', function (data) {
    ticketSchema.getTicketById(data.ticket._id, function (err, ticket) {
      if (err) {
        winston.warn('Elasticsearch Error: ' + err)
        return false
      }

      var _id = ticket._id.toString()
      var cleanedTicket = {
        id: _id,
        uid: ticket.uid,
        subject: ticket.subject,
        issue: ticket.issue,
        date: ticket.date,
        dateFormatted: moment
          .utc(ticket.date)
          .tz(TS.timezone)
          .format('MMMM D YYYY'),
        owner: ticket.owner,
        assignee: ticket.assignee,
        group: {
          _id: ticket.group._id,
          name: ticket.group.name
        },
        comments: ticket.comments,
        notes: ticket.notes,
        deleted: ticket.deleted,
        priority: {
          _id: ticket.priority._id,
          name: ticket.priority.name,
          htmlColor: ticket.priority.htmlColor
        },
        type: { _id: ticket.type._id, name: ticket.type.name },
        status: ticket.status,
        tags: ticket.tags
      }
      // todo need to create a schema
      //  Typesense can index a multi-value array. In the schema, define the type of the field as string[]
      // Typesense does not index a dictionary or nested fields though: they have to be flattened out. https://github.com/typesense/typesense/issues/256
      TS.tsclient
        .collections(TS.indexName)
        .documents()
        .create(cleanedTicket)
    })
  })
}

TS.buildClient = function (host) {
  if (TS.tsclient) {
    TS.tsclient.close()
  }

  TS.tsclient = new Typesense.Client({
    nodes: [
      {
        host: host, // host, For Typesense Cloud use xxx.a1.typesense.net
        port: '8108', // For Typesense Cloud use 443
        protocol: 'http' // For Typesense Cloud use https
      }
    ],
    apiKey: '<API_KEY>',
    connectionTimeoutSeconds: 2
  })
}

TS.rebuildIndex = function () {
  if (global.esRebuilding) {
    winston.warn('Index Rebuild attempted while already rebuilding!')
    return
  }
  settingUtil.getSettings(function (err, settings) {
    if (err) {
      winston.warn(err)
      return false
    }
    if (!settings.data.settings.elasticSearchConfigured.value) return false

    var s = settings.data.settings

    var ELASTICSEARCH_URI = s.elasticSearchHost.value + ':' + s.elasticSearchPort.value

    TS.buildClient(ELASTICSEARCH_URI)

    global.esStatus = 'Rebuilding...'

    var fork = require('child_process').fork
    var esFork = fork(path.join(__dirname, 'rebuildIndexChild.js'), {
      env: {
        FORK: 1,
        NODE_ENV: global.env,
        ELASTICSEARCH_INDEX_NAME: TS.indexName,
        ELASTICSEARCH_URI: ELASTICSEARCH_URI,
        MONGODB_URI: global.CONNECTION_URI
      }
    })

    global.esRebuilding = true
    global.forks.push({ name: 'elasticsearchRebuild', fork: esFork })

    esFork.once('message', function (data) {
      global.esStatus = data.success ? 'Connected' : 'Error'
      global.esRebuilding = false
    })

    esFork.on('exit', function () {
      winston.debug('Rebuilding Process Closed: ' + esFork.pid)
      global.esRebuilding = false
      global.forks = _.filter(global.forks, function (i) {
        return i.name !== 'elasticsearchRebuild'
      })
    })
  })
}

TS.getIndexCount = function (callback) {
  if (_.isUndefined(TS.tsclient)) return callback('Typesense has not initialized')

  TS.tsclient
    .collections(TS.indexName)
    .retrieve()
    .then(function (r) {
      var data = {}
      data.count = r.num_documents
      return callback(data)
    })
}

TS.init = function (callback) {
  global.esStatus = 'Not Configured'
  global.esRebuilding = false
  settingUtil.getSettings(function (err, s) {
    var settings = s.data.settings

    var ENABLED = settings.elasticSearchConfigured.value
    if (!ENABLED) {
      if (_.isFunction(callback)) return callback()

      return false
    }

    winston.debug('Initializing Elasticsearch...')
    global.esStatus = 'Initializing'
    TS.timezone = settings.timezone.value

    TS.setupHooks()

    if (process.env.ELATICSEARCH_URI) TS.host = process.env.ELATICSEARCH_URI
    else TS.host = settings.elasticSearchHost.value + ':' + settings.elasticSearchPort.value

    TS.buildClient(TS.host)

    async.series(
      [
        function (next) {
          checkConnection(function (err) {
            if (err) return next(err)

            winston.info('Elasticsearch Running... Connected.')
            global.esStatus = 'Connected'
            return next()
          })
        }
      ],
      function (err) {
        if (err) global.esStatus = 'Error'

        if (_.isFunction(callback)) return callback(err)
      }
    )
  })
}

TS.checkConnection = function (callback) {
  // global.esStatus = 'Please Wait...'
  return checkConnection(function (err) {
    if (err) {
      global.esStatus = 'Error'
      winston.warn(err)
      return callback()
    }

    global.esStatus = 'Connected'
    return callback()
  })
}

module.exports = TS
