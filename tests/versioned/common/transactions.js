'use strict'

const setup = require('./setup')
const utils = require('@newrelic/test-utilities')


const params = setup.params
const DBUSER = 'test_user'
const DBNAME = 'agent_integration'


module.exports = (t, requireMySQL) => {
  t.test('MySQL transactions', {timeout: 30000}, (t) => {
    t.plan(8)

    // set up the instrumentation before loading MySQL
    const helper = utils.TestAgent.makeInstrumented()
    helper.registerInstrumentation({
      moduleName: 'mysql',
      type: 'datastore',
      onRequire: require('../../../lib/instrumentation').callbackInitialize
    })
    const mysql = requireMySQL(helper)

    t.tearDown(() => helper.unload())

    setup(mysql, function(error) {
      t.error(error)

      const client = mysql.createConnection({
        user: DBUSER,
        database: DBNAME,
        host: params.mysql_host,
        port: params.mysql_port
      })

      t.tearDown(() => client.end())

      t.notOk(helper.getTransaction(), 'no transaction should be in play yet')
      helper.runInTransaction((txn) => {
        client.beginTransaction((err) => {
          if (!t.error(err)) {
            t.end()
            return
          }
          t.transaction(txn)

          // trying the object mode of client.query
          client.query({sql: 'SELECT 1', timeout: 10}, (err) => {
            if (!t.error(err)) {
              t.end()
              return
            }

            t.transaction(txn)
            client.commit((err) => {
              if (!t.error(err)) {
                t.end()
                return
              }

              t.transaction(txn)
            })
          })
        })
      })
    })
  })
}