let https = require('https')

let red = require('./red')

function get (url, maxAttempts = 1, attempt = 1) {
  return new Promise((resolve, reject) => {
    https
      .get(url, res => {
        let buffer = ''
        res.on('data', i => {
          buffer += i
        })
        res.on('end', () => {
          resolve(JSON.parse(buffer))
        })
      })
      .on('error', reject)
  }).catch(e => {
    if (attempt < maxAttempts) {
      process.stderr.write(red('E'))
      return get(url, maxAttempts, attempt + 1)
    } else {
      throw e
    }
  })
}

module.exports = get
