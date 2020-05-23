let chalk
try {
  chalk = require('chalk')
} catch {}

if (chalk) {
  module.exports = chalk.red
} else {
  module.exports = str => str
}
