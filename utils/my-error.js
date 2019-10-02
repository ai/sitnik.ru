let { red } = require('chalk')

class MyError extends Error {
  constructor (message) {
    super(message)
    this.name = 'MyError'
    Error.captureStackTrace(this, this.constructor)
  }
}

MyError.print = e => {
  process.stderr.write('\n')
  if (e.name === 'MyError' && e.message) {
    process.stderr.write(red(e.message))
  } else {
    process.stderr.write(red(e.stack))
  }
  process.stderr.write('\n')
  process.exit(1)
}

module.exports = MyError
