let { readFile } = require('fs').promises

async function read (file) {
  let buffer = await readFile(file)
  return buffer.toString()
}

module.exports = read
