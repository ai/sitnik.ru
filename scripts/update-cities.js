#!/usr/bin/env node

import { fileURLToPath } from 'url'
import { join, dirname } from 'path'
import { existsSync } from 'fs'
import { writeFile } from 'fs/promises'
import parser from 'fast-xml-parser'
import dotenv from 'dotenv'
import pico from 'picocolors'

import { MyError } from './lib/my-error.js'
import { read } from './lib/read.js'
import { get } from './lib/get.js'

dotenv.config()

let BOOKMARKS_URL = 'https://www.google.com/bookmarks/lookup?output=xml'

const SCRIPTS = dirname(fileURLToPath(import.meta.url))
const BOOKMARKS_FILE = join(SCRIPTS, 'cities', 'bookmarks.xml')
const PROCESSED_FILE = join(SCRIPTS, 'cities', 'processed.json')
const CITIES_FILE = join(SCRIPTS, 'cities', 'cities.json')
const DOTS_FILE = join(SCRIPTS, '..', 'src', 'earth', 'dots.js')

// Helpers

function print(message, number) {
  process.stderr.write(message)
  if (number) process.stderr.write(': ' + pico.bold(pico.green(number)))
  process.stderr.write('\n')
}

let requests = 0
let pool = []

function nextTick() {
  let tick = pool.pop()
  if (!tick) return

  requests += 1
  get(tick[0], 3)
    .then(answer => {
      if (answer.status === 'ZERO_RESULTS' || answer.status === 'NOT_FOUND') {
        throw new MyError('404')
      } else if (answer.status === 'OK') {
        process.stderr.write(pico.gray('#'))
        return answer
      } else {
        throw new MyError(answer.error_message)
      }
    })
    .then(data => {
      requests -= 1
      tick[1](data)
      nextTick()
    })
    .catch(tick[2])
}

function gmap(name, token, params) {
  params.key = token
  let query = Object.keys(params)
    .map(i => i + '=' + encodeURIComponent(params[i]))
    .join('&')
  let url = `https://maps.googleapis.com/maps/api/${name}?${query}`
  return new Promise((resolve, reject) => {
    pool.push([url, resolve, reject])
    if (requests < 10) nextTick()
  }).catch(e => {
    if (e.message === '404') {
      process.stderr.write(
        pico.red('\n\nCan’t find ' + params.address + '\n\n')
      )
      return e.message
    } else {
      throw e
    }
  })
}

function inside(address, ...value) {
  return address.some(i => value.includes(i.long_name))
}

function cityName(responce) {
  let address = (responce.result || responce.results[0]).address_components
  let country = address.find(i => i.types.includes('country'))
  let city = address.find(i => i.types.includes('locality'))
  let inUS = country && country.short_name === 'US'
  if (!city) {
    if (inUS && inside(address, 'Brooklyn', 'Queens')) {
      city = { long_name: 'New York' }
    } else if (inside(address, 'İstanbul')) {
      city = { long_name: 'İstanbul' }
    } else {
      city = address.find(i => {
        return i.types.includes('political') && !i.short_name.includes('Krai')
      })
    }
  }
  if (inUS && city.long_name === 'Washington') {
    city.long_name += ', DC'
  }
  if (city.long_name === 'Rostov') {
    city.long_name = 'Rostov-na-Donu'
  }
  if (!country) {
    return city.long_name
  } else {
    return city.long_name + ', ' + country.long_name
  }
}

function saveLatLng(cities, city, responce) {
  let location = responce.results[0].geometry.location
  for (let i in cities) {
    if (cities[i][0] === location.lat && cities[i][1] === location.lng) {
      return
    }
  }
  cities[city] = [location.lat, location.lng]
}

function prettyStringify(data) {
  if (!Array.isArray(data)) {
    let prev = data
    data = {}
    for (let i of Object.keys(prev).sort()) {
      data[i] = prev[i]
    }
  }
  return JSON.stringify(data, null, '  ') + '\n'
}

function prettyDots(dots) {
  return (
    'export default [\n' +
    dots.map(i => `  [${i[0]}, ${i[1]}]`).join(',\n') +
    '\n]\n'
  )
}

function diff(a1, b1, a2, b2) {
  return Math.max(Math.abs(a1 - b1), Math.abs(a2 - b2))
}

function round(num) {
  return Math.round(num * 10) / 10
}

// Steps

async function initBookmarks() {
  if (!existsSync(BOOKMARKS_FILE)) {
    throw new MyError(`Save ${BOOKMARKS_URL} as scripts/cities/bookmarks.xml`)
  }
  let xml = await read(BOOKMARKS_FILE)
  let ast = parser.parse(xml, { parseTrueNumberOnly: true })
  return ast.xml_api_reply.bookmarks.bookmark
}

async function initProcessed() {
  if (existsSync(PROCESSED_FILE)) {
    return JSON.parse(await read(PROCESSED_FILE))
  } else {
    return {}
  }
}

async function initCities() {
  if (existsSync(CITIES_FILE)) {
    return JSON.parse(await read(CITIES_FILE))
  } else {
    return {}
  }
}

async function init() {
  let [bookmarks, prevProcessed, cities] = await Promise.all([
    initBookmarks(),
    initProcessed(),
    initCities()
  ])
  return { bookmarks, prevProcessed, cities }
}

function filterBookmarks(data) {
  data.processed = {}
  let cities = Object.keys(data.prevProcessed).map(i => {
    return [i, data.prevProcessed[i]]
  })
  for (let id in data.prevProcessed) {
    if (data.bookmarks.every(i => String(i.id) !== id)) {
      let city = data.prevProcessed[id]
      if (cities.every(i => i[0] === id || i[1] !== city)) {
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
    print(`Download update from ${BOOKMARKS_URL}`)
  } else {
    print('New bookmarks', data.newBookmarks.length)
  }
  return data
}

async function findCities(data) {
  let requesting = {}
  await Promise.all(
    data.newBookmarks.map(async ({ url, title, id }) => {
      let res
      let gmapsToken = process.env.GMAPS_TOKEN
      if (url.includes('?cid=')) {
        let cid = url.match(/\?cid=(\d+)/)[1]
        res = await gmap('place/details/json', gmapsToken, { cid })
      } else {
        res = await gmap('geocode/json', gmapsToken, { address: title })
      }
      if (res === '404') {
        data.processed[id] = false
        return
      }
      let city = cityName(res)
      data.processed[id] = city
      if (!data.cities[city] && !requesting[city]) {
        requesting[city] = true
        res = await gmap('geocode/json', gmapsToken, { address: city })
        if (res !== '404') saveLatLng(data.cities, city, res)
      }
    })
  )
  if (data.newBookmarks.length > 0) {
    process.stderr.write('\n')
  }
  return data
}

async function saveFiles(data) {
  let locations = Object.values(data.cities)
  let dots = locations
    .reverse()
    .filter((i, index) => {
      for (let j of locations.slice(index + 1)) {
        if (diff(i[0], j[0], i[1], j[1]) < 0.7) {
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
    writeFile(DOTS_FILE, prettyDots(dots))
  ])
  return data
}

init()
  .then(filterBookmarks)
  .then(findCities)
  .then(saveFiles)
  .catch(MyError.print)
