let { red } = require('chalk')

function error (message) {
  let e = new Error(message)
  e.local = true
  return e
}

function printError (e) {
  process.stderr.write('\n')
  if (e.local && e.message) {
    process.stderr.write(red(e.message))
  } else {
    process.stderr.write(red(e.stack))
  }
  process.stderr.write('\n')
  process.exit(1)
}

module.exports = { error, printError }
