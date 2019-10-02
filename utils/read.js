let { promisify } = require('util')
let { readFile } = require('fs')

let readFilePromise = promisify(readFile)

async function read (file) {
  let content = await readFilePromise(file)
  return content.toString()
}

module.exports = read
