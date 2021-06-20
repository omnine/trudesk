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
 *  Updated:    6/15/21 4:43 PM
 *  Copyright (c) 2014-2019. All rights reserved.
 */

var async = require('async')
var Typesense = require('typesense')
var winston = require('winston')
var moment = require('moment-timezone')
var database = require('../database')

global.env = process.env.NODE_ENV

winston.setLevels(winston.config.cli.levels)
winston.remove(winston.transports.Console)
winston.add(winston.transports.Console, {
  colorize: true,
  timestamp: function () {
    var date = new Date()
    return (
      date.getMonth() +
      1 +
      '/' +
      date.getDate() +
      ' ' +
      date.toTimeString().substr(0, 8) +
      ' [Child:TypesenseSearch:' +
      process.pid +
      ']'
    )
  },
  level: global.env === 'production' ? 'info' : 'verbose'
})

var TS = {}
TS.indexName = process.env.TYPESENSESEARCH_INDEX_NAME || 'trudesk'

function setupTimezone (callback) {
  var settingsSchema = require('../models/setting')
  settingsSchema.getSettingByName('gen:timezone', function (err, setting) {
    if (err) return callback(err)

    var tz = 'UTC'
    if (setting && setting.value) tz = setting.value

    TS.timezone = tz

    return callback(null, tz)
  })
}

function setupDatabase (callback) {
  database.init(function (err, db) {
    if (err) return callback(err)

    TS.mongodb = db

    return callback(null, db)
  }, process.env.MONGODB_URI)
}

function setupClient () {
  TS.tsclient = new Typesense.Client({
    nodes: [
      {
        host: process.env.TYPESENSESEARCH_HOST, // host, For Typesense Cloud use xxx.a1.typesense.net
        port: process.env.TYPESENSESEARCH_PORT, // '8108'
        protocol: 'http' // For Typesense Cloud use https
      }
    ],
    // get it from etc/typesense/typesense-server.ini
    apiKey: process.env.TYPESENSESEARCH_APIKEY,
    connectionTimeoutSeconds: 2
  })
}

// delete a collection
function deleteIndex (callback) {
  TS.tsclient
    .collections(TS.indexName)
    .delete()
    .then(function (res) {
      return callback()
    })
    .catch(function (err) {
      return callback(err)
    })
}

/*
If the document contains an id field of type string, Typesense would use that field as the identifier for the document. 
Otherwise, Typesense would assign an identifier of its choice to the document.
when update a document, we use mongodb id, just be compatible to elastic engine. 
Otherwise we can just use ticket uid to save a field for the simplicity

I don't think we need to add the id into schema fields.
*/

function createIndex (callback) {
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

function sendAndEmptyQueue (bulk, callback) {
  if (bulk.length > 0) {
    //index multiple documents
    TS.tsclient
      .collections(TS.indexName)
      .documents()
      .import(bulk, { action: 'create' })
      .then(function (res) {
        winston.debug('Sent ' + bulk.length + ' documents to Typesensesearch!')
        if (typeof callback === 'function') return callback()
      })
      .catch(function (err) {
        process.send({ success: false })
        return process.exit()
      })
  } else if (typeof callback === 'function') return callback()

  return []
}

function crawlTickets (callback) {
  var Model = require('../models/ticket')
  var count = 0
  var startTime = new Date().getTime()
  var stream = Model.find({ deleted: false })
    .populate('owner group comments.owner notes.owner tags priority type')
    .lean()
    .cursor()

  var bulk = []

  stream
    .on('data', function (doc) {
      stream.pause()
      count += 1

      var comments = []
      if (doc.comments !== undefined) {
        doc.comments.forEach(function (c) {
          comments.push(c.comment)
        })
      }
      var tags = []
      if (doc.tags !== undefined) {
        doc.tags.forEach(function (t) {
          tags.push(t.name)
        })
      }
      var notes = []
      if (doc.notes !== undefined) {
        doc.notes.forEach(function (n) {
          notes.push(n.note)
        })
      }

      //same order as the schema, but it doesn't matter
      bulk.push({
        id: doc._id.toString(), //Typesense would use that field as the identifier for the document
        uid: doc.uid,
        subject: doc.subject,
        issue: doc.issue,
        comments: comments,
        notes: notes,
        deleted: doc.deleted,
        tags: tags,
        status: doc.status
      })

      if (count % 200 === 1) bulk = sendAndEmptyQueue(bulk)

      stream.resume()
    })
    .on('err', function (err) {
      winston.error(err)
      // Send Error Occurred - Kill Process
      throw err
    })
    .on('close', function () {
      winston.debug('Document Count: ' + count)
      winston.debug('Duration is: ' + (new Date().getTime() - startTime))
      bulk = sendAndEmptyQueue(bulk, callback)
    })
}

function rebuild (callback) {
  async.series(
    [
      function (next) {
        setupDatabase(next)
      },
      function (next) {
        setupTimezone(next)
      },
      function (next) {
        deleteIndex(next)
      },
      function (next) {
        createIndex(next)
      },
      function (next) {
        crawlTickets(next)
      }
    ],
    function (err) {
      if (err) winston.error(err)

      return callback(err)
    }
  )
}

;(function () {
  setupClient()
  rebuild(function (err) {
    if (err) {
      winston.debug('rebuild error happened')
      process.send({ success: false, error: err })
      return process.exit(0)
    }

    //  Kill it in 10sec to offset refresh timers
    setTimeout(function () {
      process.send({ success: true })
      return process.exit()
    }, 6000)
  })
})()
