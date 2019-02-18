#!/usr/bin/env node

let { red, gray, bold, green } = require('chalk')
let { promisify } = require('util')
let { get } = require('https')
let parser = require('fast-xml-parser')
let path = require('path')
let fs = require('fs')

let writeFile = promisify(fs.writeFile)
let readFile = promisify(fs.readFile)

let BOOKMARKS_URL = 'https://www.google.com/bookmarks/lookup?output=xml'
let TOKENS_URL = 'https://console.cloud.google.com/apis/credentials'

let BOOKMARKS_FILE = path.join(__dirname, 'bookmarks.xml')
let PROCESSED_FILE = path.join(__dirname, 'processed.json')
let CITIES_FILE = path.join(__dirname, 'cities.json')
let TOKEN_FILE = path.join(__dirname, 'token.txt')
let DOTS_FILE = path.join(__dirname, 'dots.js')

// Helpers

function print (message, number) {
  process.stderr.write(message)
  if (number) process.stderr.write(': ' + bold(green(number)))
  process.stderr.write('\n')
}

function error (message) {
  let e = new Error(message)
  e.local = true
  return e
}

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

let requests = 0
let pool = []

function nextTick () {
  let tick = pool.pop()
  if (!tick) return

  requests += 1
  request(tick[0]).then(data => {
    requests -= 1
    tick[1](data)
    nextTick()
  }).catch(tick[2])
}

function gmap (name, params) {
  let query = Object.keys(params)
    .map(i => i + '=' + encodeURIComponent(params[i]))
    .join('&')
  let url = `https://maps.googleapis.com/maps/api/${ name }?${ query }`
  return new Promise((resolve, reject) => {
    pool.push([url, resolve, reject])
    if (requests < 10) nextTick()
  }).catch(e => {
    if (e.message === '404') {
      process.stderr.write(red('\n\nCan’t find ' + params.address + '\n\n'))
      return e.message
    } else {
      throw e
    }
  })
}

function cityName (responce) {
  let address = (responce.result || responce.results[0]).address_components
  let country = address.find(i => i.types.indexOf('country') !== -1)
  let city = address.find(i => i.types.indexOf('locality') !== -1)
  if (!city) city = address.find(i => i.types.indexOf('political') !== -1)
  if (!country) {
    return city.long_name
  } else {
    return city.long_name + ', ' + country.long_name
  }
}

function saveLatLng (cities, city, responce) {
  let location = responce.results[0].geometry.location
  for (let i in cities) {
    if (cities[i][0] === location.lat && cities[i][1] === location.lng) {
      return
    }
  }
  cities[city] = [location.lat, location.lng]
}

function prettyStringify (data) {
  if (!Array.isArray(data)) {
    let prev = data
    data = { }
    for (let i of Object.keys(prev).sort()) {
      data[i] = prev[i]
    }
  }
  return JSON.stringify(data, null, '  ') + '\n'
}

function diff (a1, b1, a2, b2) {
  return Math.max(Math.abs(a1 - b1), Math.abs(a2 - b2))
}

function round (num) {
  return Math.round(num * 1000000) / 1000000
}

// Steps

async function loadToken () {
  if (!fs.existsSync(TOKEN_FILE)) {
    throw error(`Save token from ${ TOKENS_URL } to cities/token.txt`)
  }
  let token = await readFile(TOKEN_FILE)
  return token.toString().trim()
}

async function initBookmarks () {
  if (!fs.existsSync(BOOKMARKS_FILE)) {
    throw error(`Save ${ BOOKMARKS_URL } as cities/bookmarks.xml`)
  }
  let xml = await readFile(BOOKMARKS_FILE)
  let ast = parser.parse(xml.toString(), { parseTrueNumberOnly: true })
  return ast.xml_api_reply.bookmarks.bookmark
}

async function initProcessed () {
  if (fs.existsSync(PROCESSED_FILE)) {
    return JSON.parse(await readFile(PROCESSED_FILE))
  } else {
    return { }
  }
}

async function initCities () {
  if (fs.existsSync(CITIES_FILE)) {
    return JSON.parse(await readFile(CITIES_FILE))
  } else {
    return { }
  }
}

async function init () {
  let [token, bookmarks, prevProcessed, cities] = await Promise.all([
    loadToken(),
    initBookmarks(),
    initProcessed(),
    initCities()
  ])
  return { token, bookmarks, prevProcessed, cities }
}

function filterBookmarks (data) {
  data.processed = { }
  let cities = Object.keys(data.prevProcessed).map(i => {
    return [i, data.prevProcessed[i]]
  })
  for (let id in data.prevProcessed) {
    if (!data.bookmarks.find(i => String(i.id) === id)) {
      let city = data.prevProcessed[id]
      if (!cities.find(i => i[0] !== id && i[1] === city)) {
        delete data.cities[city]
      }
    }
  }
  data.newBookmarks = data.bookmarks.filter(({ id }) => {
    if (data.prevProcessed[id]) {
      data.processed[id] = data.prevProcessed[id]
      return false
    } else {
      return true
    }
  })
  if (data.newBookmarks.length === 0) {
    print('No new bookmarks')
    print(`Download update from ${ BOOKMARKS_URL }`)
  } else {
    print('New bookmarks', data.newBookmarks.length)
  }
  return data
}

async function findCities (data) {
  let requesting = { }
  await Promise.all(data.newBookmarks.map(async ({ url, title, id }) => {
    let res
    if (url.indexOf('?cid=') !== -1) {
      let cid = url.match(/\?cid=(\d+)/)[1]
      res = await gmap('place/details/json', { cid, key: data.token })
    } else {
      res = await gmap('geocode/json', { address: title, key: data.token })
    }
    if (res === '404') {
      data.processed[id] = false
      return
    }
    let city = cityName(res)
    data.processed[id] = city
    if (!data.cities[city] && !requesting[city]) {
      requesting[city] = true
      res = await gmap('geocode/json', { address: city, key: data.token })
      if (res !== '404') saveLatLng(data.cities, city, res)
    }
  }))
  if (data.newBookmarks.length > 0) {
    process.stderr.write('\n')
  }
  return data
}

async function saveFiles (data) {
  let locations = Object.values(data.cities)
  let dots = locations
    .reverse()
    .filter((i, index) => {
      for (let j of locations.slice(index + 1)) {
        if (diff(i[0], j[0], i[1], j[1]) < 1.5) {
          return false
        }
      }
      return true
    })
    .map(i => [round(i[0]), round([i[1]])])
    .sort((a, b) => a[0] + a[1] - b[0] - b[1])

  print('Total cities', Object.values(data.cities).length)
  await Promise.all([
    writeFile(PROCESSED_FILE, prettyStringify(data.processed)),
    writeFile(CITIES_FILE, prettyStringify(data.cities)),
    writeFile(DOTS_FILE, 'module.exports = ' + prettyStringify(dots))
  ])
  return data
}

init()
  .then(filterBookmarks)
  .then(findCities)
  .then(saveFiles)
  .catch(e => {
    process.stderr.write('\n')
    if (e.local && e.message) {
      process.stderr.write(red(e.message))
    } else {
      process.stderr.write(red(e.stack))
    }
    process.exit(1)
  })
