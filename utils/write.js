let { promisify } = require('util')
let { writeFile } = require('fs')

module.exports = promisify(writeFile)
