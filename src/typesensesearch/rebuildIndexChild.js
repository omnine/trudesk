var async = require('async')
var elasticsearch = require('elasticsearch')
var winston = require('winston')
var moment = require('moment-timezone')
var database = require('../database')

global.env = process.env.NODE_ENV || 'production'

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
      ' [Child:ElasticSearch:' +
      process.pid +
      ']'
    )
  },
  level: global.env === 'production' ? 'info' : 'verbose'
})

var TS = {}
TS.indexName = process.env.ELASTICSEARCH_INDEX_NAME || 'trudesk'

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
  TS.tsclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH_URI,
    pingTimeout: 10000,
    maxRetries: 5
  })

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

function createIndex (callback) {
  TS.tsclient.indices.create(
    {
      index: TS.indexName,
      body: {
        settings: {
          index: {
            number_of_replicas: 0
          },
          analysis: {
            filter: {
              leadahead: {
                type: 'edge_ngram',
                min_gram: 1,
                max_gram: 20
              },
              email: {
                type: 'pattern_capture',
                preserve_original: true,
                patterns: ['([^@]+)', '(\\p{L}+)', '(\\d+)', '@(.+)']
              }
            },
            analyzer: {
              leadahead: {
                type: 'custom',
                tokenizer: 'standard',
                filter: ['lowercase', 'leadahead']
              },
              email: {
                tokenizer: 'uax_url_email',
                filter: ['email', 'lowercase', 'unique']
              }
            }
          }
        },
        mappings: {
          doc: {
            properties: {
              uid: {
                type: 'text',
                analyzer: 'leadahead',
                search_analyzer: 'standard'
              },
              subject: {
                type: 'text',
                analyzer: 'leadahead',
                search_analyzer: 'standard'
              },
              issue: {
                type: 'text',
                analyzer: 'leadahead',
                search_analyzer: 'standard'
              },
              dateFormatted: {
                type: 'text',
                analyzer: 'leadahead',
                search_analyzer: 'standard'
              },
              comments: {
                properties: {
                  comment: {
                    type: 'text',
                    analyzer: 'leadahead',
                    search_analyzer: 'standard'
                  },
                  owner: {
                    properties: {
                      email: {
                        type: 'text',
                        analyzer: 'email'
                      }
                    }
                  }
                }
              },
              notes: {
                properties: {
                  note: {
                    type: 'text',
                    analyzer: 'leadahead',
                    search_analyzer: 'standard'
                  },
                  owner: {
                    properties: {
                      email: {
                        type: 'text',
                        analyzer: 'email'
                      }
                    }
                  }
                }
              },
              owner: {
                properties: {
                  email: {
                    type: 'text',
                    analyzer: 'email'
                  }
                }
              }
            }
          }
        }
      }
    },
    callback
  )
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

      bulk.push({ index: { _index: TS.indexName, _type: 'doc', _id: doc._id } })
      var comments = []
      if (doc.comments !== undefined) {
        doc.comments.forEach(function (c) {
          comments.push({
            comment: c.comment,
            _id: c._id,
            deleted: c.deleted,
            date: c.date,
            owner: {
              _id: c.owner._id,
              fullname: c.owner.fullname,
              username: c.owner.username,
              email: c.owner.email,
              role: c.owner.role,
              title: c.owner.title
            }
          })
        })
      }
      bulk.push({
        datatype: 'ticket',
        uid: doc.uid,
        owner: {
          _id: doc.owner._id,
          fullname: doc.owner.fullname,
          username: doc.owner.username,
          email: doc.owner.email,
          role: doc.owner.role,
          title: doc.owner.title
        },
        group: {
          _id: doc.group._id,
          name: doc.group.name
        },
        status: doc.status,
        issue: doc.issue,
        subject: doc.subject,
        date: doc.date,
        dateFormatted: moment
          .utc(doc.date)
          .tz(TS.timezone)
          .format('MMMM D YYYY'),
        priority: {
          _id: doc.priority._id,
          name: doc.priority.name,
          htmlColor: doc.priority.htmlColor
        },
        type: { _id: doc.type._id, name: doc.type.name },
        deleted: doc.deleted,
        comments: comments,
        notes: doc.notes,
        tags: doc.tags
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
