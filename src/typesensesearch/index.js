/*
     .                              .o8                     oooo
   .o8                             "888                     `888
 .o888oo oooo d8b oooo  oooo   .oooo888   .ooooo.   .oooo.o  888  oooo
   888   `888""8P `888  `888  d88' `888  d88' `88b d88(  "8  888 .8P'
   888    888      888   888  888   888  888ooo888 `"Y88b.   888888.
   888 .  888      888   888  888   888  888    .o o.  )88b  888 `88b.
   "888" d888b     `V88V"V8P' `Y8bod88P" `Y8bod8P' 8""888P' o888o o888o
 ========================================================================
 Created:    06/14/2021
 Author:     Omnine

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

var TS = { port: 8108 }
TS.indexName = process.env.TYPESENSESEARCH_INDEX_NAME || 'trudesk'

function checkConnection (callback) {
  if (!TS.tsclient) return callback('Typesense client not initialized. Restart Trudesk!')

  TS.tsclient.health
    .retrieve()
    .then(function (res) {
      // res = {ok: true}
      winston.debug('Typesensesearch checking health OK')
      //should use try/catch
      return callback(null)
    })
    .catch(function (err) {
      //    console.log("Promise Rejected");
      winston.debug('Typesensesearch checking health failed')
      return callback(null)
    })
}

TS.testConnection = function (callback) {
  if (process.env.TYPESENSESEARCH_URI) TS.host = process.env.TYPESENSESEARCH_URI
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
        winston.warn('Typesensesearch Error: ' + err)
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
        winston.warn('Typesensesearch Error: ' + err)
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

TS.buildClient = function (host, port, apikey) {
  if (TS.tsclient) {
    return
  }

  TS.tsclient = new Typesense.Client({
    nodes: [
      {
        host: host, // host, For Typesense Cloud use xxx.a1.typesense.net
        port: port, // '8108'
        protocol: 'http' // For Typesense Cloud use https
      }
    ],
    // get it from etc/typesense/typesense-server.ini
    apiKey: apikey,
    connectionTimeoutSeconds: 2
  })
}

TS.rebuildIndex = function () {
  if (global.tsRebuilding) {
    winston.warn('Index Rebuild attempted while already rebuilding!')
    return
  }
  settingUtil.getSettings(function (err, settings) {
    if (err) {
      winston.warn(err)
      return false
    }
    if (!settings.data.settings.typesenseSearchConfigured.value) return false

    var s = settings.data.settings

    //    TS.buildClient(s.typesenseSearchHost.value, s.typesenseSearchPort.value, s.typesenseSearchAPIKey.value)

    global.tsStatus = 'Rebuilding...'

    var fork = require('child_process').fork
    var tsFork = fork(path.join(__dirname, 'rebuildIndexChild.js'), {
      execArgv: [], // this is important to inspect the child process, https://github.com/nodejs/node/issues/9435
      env: {
        FORK: 1,
        NODE_ENV: global.env,
        TYPESENSESEARCH_INDEX_NAME: TS.indexName,
        TYPESENSESEARCH_HOST: s.typesenseSearchHost.value,
        TYPESENSESEARCH_PORT: s.typesenseSearchPort.value,
        TYPESENSESEARCH_APIKEY: s.typesenseSearchAPIKey.value,
        MONGODB_URI: global.CONNECTION_URI
      }
    })

    global.tsRebuilding = true
    global.forks.push({ name: 'typesensesearchRebuild', fork: tsFork })

    tsFork.once('message', function (data) {
      global.tsStatus = data.success ? 'Connected' : 'Error'
      global.tsRebuilding = false
    })

    tsFork.on('exit', function () {
      winston.debug('Rebuilding Process Closed: ' + tsFork.pid)
      global.tsRebuilding = false
      global.forks = _.filter(global.forks, function (i) {
        return i.name !== 'typesensesearchRebuild'
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
      return callback(null, data)
    })
    .catch(function (err) {
      winston.debug(err)
      return callback(err)
    })
}

TS.init = function (callback) {
  global.tsStatus = 'Not Configured'
  global.tsRebuilding = false
  settingUtil.getSettings(function (err, s) {
    var settings = s.data.settings

    var ENABLED = settings.typesenseSearchConfigured.value
    if (!ENABLED) {
      if (_.isFunction(callback)) return callback()

      return false
    }

    winston.debug('Initializing Typesensesearch...')
    global.tsStatus = 'Initializing'
    TS.timezone = settings.timezone.value

    TS.setupHooks()

    if (process.env.TYPESENSESEARCH_URI) {
      TS.host = process.env.TYPESENSESEARCH_URI
    } else {
      TS.host = settings.typesenseSearchHost.value
      TS.port = settings.typesenseSearchPort.value
      TS.apikey = settings.typesenseSearchAPIKey.value
    }

    TS.buildClient(TS.host, TS.port, TS.apikey)

    async.series(
      [
        function (next) {
          checkConnection(function (err) {
            if (err) return next(err)

            winston.info('Typesensesearch Running... Connected.')
            global.tsStatus = 'Connected'
            return next()
          })
        }
      ],
      function (err) {
        if (err) global.tsStatus = 'Error'

        if (_.isFunction(callback)) return callback(err)
      }
    )
  })
}

TS.checkConnection = function (callback) {
  // global.tsStatus = 'Please Wait...'
  return checkConnection(function (err) {
    if (err) {
      global.tsStatus = 'Error'
      winston.warn(err)
      return callback(err)
    }

    global.tsStatus = 'Connected'
    return callback(null)
  })
}

// Unlike Typesensesearch, Typesense need to create a collection first
/*
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

Typesense allows you to index the following types of fields:

string
int32
int64
float
bool

shell creation

curl "http://localhost:8108/collections" -X POST -H "Content-Type: application/json" \
      -H "X-TYPESENSE-API-KEY: your-api-key" -d '{
        "name": "trudesk",
        "fields": [
          {"name": "uid", "type": "int32" },
          {"name": "subject", "type": "string" },
          {"name": "issue", "type": "string" },
          {"name": "comments", "type": "string[]" },
          {"name": "notes", "type": "string[]" },

          {"name": "deleted", "type": "bool" },
          {"name": "tags", "type": "string[]" },
          {"name": "tags_facet", "type": "string[]", "facet": true },
          {"name": "status", "type": "string" }

        ],
        "default_sorting_field": "uid"
      }'

      is there any better field in ticket for default_sorting_field? status?

*/
TS.createCollection = function (callback) {
  let ticketsSchema = {
    name: TS.indexName,
    fields: [
      { name: 'uid', type: 'int32' },
      { name: 'subject', type: 'string' },
      { name: 'issue', type: 'string' },
      { name: 'comments', type: 'string[]', optional: true },
      { name: 'notes', type: 'string[]', optional: true },

      { name: 'deleted', type: 'bool' },
      { name: 'tags', type: 'string[]', facet: true, optional: true },
      { name: 'status', type: 'int32' }
    ],
    default_sorting_field: 'status'
  }

  TS.tsclient
    .collections()
    .create(ticketsSchema)
    .then(function (data) {
      //what the response is?
      return callback()
    })
}

module.exports = TS
