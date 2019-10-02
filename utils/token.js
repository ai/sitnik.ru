let { existsSync } = require('fs')
let { promisify } = require('util')
let { join } = require('path')
let readFile = promisify(require('fs').readFile)

let MyError = require('./my-error')

let TOKEN_FILE = join(__dirname, '..', 'token.txt')

async function loadToken () {
  if (!existsSync(TOKEN_FILE)) {
    throw new MyError('Decrypt token file with `yarn decrypt`')
  }
  let token = await readFile(TOKEN_FILE)
  return token.toString().trim()
}

module.exports = loadToken
