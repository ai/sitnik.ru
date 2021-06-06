import { get as httpGet } from 'https'

export function get(url, maxAttempts = 1, attempt = 1) {
  return new Promise((resolve, reject) => {
    httpGet(url, res => {
      let buffer = ''
      res.on('data', i => {
        buffer += i
      })
      res.on('end', () => {
        resolve(JSON.parse(buffer))
      })
    }).on('error', reject)
  }).catch(e => {
    if (attempt < maxAttempts) {
      process.stderr.write('E')
      return get(url, maxAttempts, attempt + 1)
    } else {
      throw e
    }
  })
}
