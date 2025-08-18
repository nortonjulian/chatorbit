
'use strict'

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./messaging.cjs.production.min.js')
} else {
  module.exports = require('./messaging.cjs.development.js')
}
