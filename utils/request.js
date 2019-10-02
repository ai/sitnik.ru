let { red, gray } = require('chalk')
let { get } = require('https')

let { error } = require('../utils/error')

function request (url, attempt = 1) {
  return new Promise((resolve, reject) => {
    get(url, res => {
      let buffer = ''
      res.on('data', i => {
        buffer += i
      })
      res.on('end', () => {
        let answer = JSON.parse(buffer)
        if (answer.status === 'ZERO_RESULTS' || answer.status === 'NOT_FOUND') {
          reject(error('404'))
        } else if (answer.status === 'OK') {
          process.stderr.write(gray('#'))
          resolve(answer)
        } else {
          reject(error(answer.error_message))
        }
      })
    }).on('error', reject)
  }).catch(e => {
    if (attempt < 3 && !e.local) {
      process.stderr.write(red('E'))
      return request(url, attempt + 1)
    } else {
      throw e
    }
  })
}

module.exports = request
