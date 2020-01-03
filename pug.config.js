let { readFileSync, existsSync } = require('fs')
let { join } = require('path')

let FILE = join(__dirname, 'src', 'globe', 'location.json')

let location = {
  latitude: 40.7128,
  longitude: -74.0060,
  en: { country: 'USA', city: 'New York' },
  ru: { country: 'США', city: 'Нью-Йорк' }
}
if (existsSync(FILE)) {
  location = JSON.parse(readFileSync(FILE))
}

module.exports = {
  locals: {
    location
  }
}
