let chalk
try {
  chalk = require('chalk')
} catch (e) { }

if (chalk) {
  module.exports = chalk.red
} else {
  module.exports = str => str
}
