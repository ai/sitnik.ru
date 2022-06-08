#!/usr/bin/env node

import { writeFile, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import dotenv from 'dotenv'
import pico from 'picocolors'

import { CITIES, PLACES, DOTS, COUNTRIES } from './lib/dirs.js'
import { MyError } from './lib/my-error.js'
import { read } from './lib/read.js'
import { get } from './lib/get.js'

const MIN_DISTANCE = 0.7

dotenv.config()

// Helpers

function print(message, number) {
  process.stderr.write(message)
  if (number) process.stderr.write(': ' + pico.bold(pico.green(number)))
  process.stderr.write('\n')
}

function prettyDots(dots) {
  return (
    'export default [\n' +
    dots.map(i => `  [${i[0]}, ${i[1]}]`).join(',\n') +
    '\n]\n'
  )
}

function distance(a, b) {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]))
}

function round2(num) {
  return Math.round(num * 100) / 100
}

function round1(num) {
  return Math.round(num * 10) / 10
}

function inside(address, ...value) {
  return address.some(i => value.includes(i.long_name))
}

function prettyJson(data) {
  return JSON.stringify(data, null, '  ') + '\n'
}

// Google Maps API

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

function cityName(response) {
  let city, inUS, country
  for (let result of response.results) {
    let address = result.address_components
    country = address.find(i => i.types.includes('country'))
    city = address.find(i => i.types.includes('locality'))
    inUS = country && country.short_name === 'US'
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
    if (city && city.long_name) break
  }
  if (!city || !city.long_name) {
    process.stderr.write('\n')
    console.log(city ?? response.results)
    throw new Error('No city name')
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

function gmap(name, params) {
  let query = Object.keys(params)
    .map(i => i + '=' + encodeURIComponent(params[i]))
    .join('&')
  let url = `https://maps.googleapis.com/maps/api/${name}?${query}`
  return new Promise((resolve, reject) => {
    pool.push([url, resolve, reject])
    if (requests < 5) nextTick()
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

// Steps

async function initCities() {
  if (existsSync(CITIES)) {
    return JSON.parse(await read(CITIES))
  } else {
    return {}
  }
}

async function initPlaces() {
  if (!existsSync(PLACES)) {
    throw new MyError(
      'Export places from https://takeout.google.com/ ' +
        'to scripts/cities/places.json'
    )
  }
  let places = JSON.parse(await read(PLACES)).features
  print('Places:   ' + pico.bold(places.length))
  return places
}

async function init() {
  let [cities, places] = await Promise.all([initCities(), initPlaces()])
  return { cities, places }
}

function reduceDots(data) {
  data.dots = []
  for (let place of data.places) {
    let near = data.dots.find(point => {
      return distance(point, place.geometry.coordinates) < MIN_DISTANCE
    })
    if (!near) {
      data.dots.push(place.geometry.coordinates)
    }
  }
  print('Cities:   ' + pico.bold(data.dots.length))

  data.dots = data.dots
    .sort((a, b) => a[0] + a[1] - b[0] - b[1])
    .map(i => [round2(i[1]), round2(i[0])])

  return data
}

async function loadCities(data) {
  let sent = false
  await Promise.all(
    data.dots.map(async dot => {
      let wasProcessed = Object.values(data.cities).find(i => {
        return dot[0] === i[0] && dot[1] === i[1]
      })
      if (!wasProcessed) {
        sent = true
        let res = await gmap('geocode/json', {
          latlng: dot.join(','),
          key: process.env.GMAPS_TOKEN
        })
        let city = cityName(res)
        data.cities[city] = dot
      }
    })
  )
  for (let city in data.cities) {
    let found = data.dots.find(dot => {
      return data.cities[city][0] === dot[0] && data.cities[city][1] === dot[1]
    })
    if (!found) {
      delete data.cities[city]
    }
  }
  if (sent) process.stdout.write('\n')
  return data
}

async function foundCountries(data) {
  let countries = {
    Vatican: true
  }
  for (let city of Object.keys(data.cities)) {
    if (city.includes(',')) {
      let country = city.split(',')[1].trim()
      if (country !== 'DC') {
        countries[country] = true
      }
    } else {
      countries[city] = true
    }
  }
  data.countries = Object.keys(countries).sort()
  print('Countries: ' + pico.bold(data.countries.length))
  return data
}

async function saveFile(data) {
  let output = prettyDots(data.dots.map(i => [round1(i[0]), round1(i[1])]))
  let prevDots = await readFile(DOTS)
  if (prevDots.toString() === output) {
    print(pico.yellow('\nNo new cities'))
    print(`Download update from https://takeout.google.com/`)
  }
  await Promise.all([
    writeFile(COUNTRIES, prettyJson(data.countries)),
    writeFile(DOTS, output),
    writeFile(CITIES, prettyJson(data.cities))
  ])
}

init()
  .then(reduceDots)
  .then(loadCities)
  .then(foundCountries)
  .then(saveFile)
  .catch(MyError.print)
