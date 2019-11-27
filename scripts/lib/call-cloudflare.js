let { request } = require('https')

let MyError = require('./my-error')

function callCloudflare (command, opts) {
  return new Promise((resolve, reject) => {
    let req = request({
      method: 'POST',
      hostname: 'api.cloudflare.com',
      path: `/client/v4/zones/${ process.env.CLOUDFLARE_ZONE }/${ command }`,
      headers: {
        'Authorization': `Bearer ${ process.env.CLOUDFLARE_TOKEN }`,
        'Content-Type': 'application/json'
      }
    }, res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', () => {
        let answer = JSON.parse(data)
        if (answer.success) {
          resolve()
        } else {
          reject(new MyError(answer.errors[0].message))
        }
      })
    })
    req.on('error', reject)
    if (opts) req.write(JSON.stringify(opts))
    req.end()
  })
}

module.exports = callCloudflare
