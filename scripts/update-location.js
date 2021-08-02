#!/usr/bin/env node

import { writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'
import dotenv from 'dotenv'

import { MyError } from './lib/my-error.js'
import { read } from './lib/read.js'
import { get } from './lib/get.js'

dotenv.config()

const FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  'location',
  'last.json'
)

async function loadLatLng() {
  return get('https://evilmartians.com/locations/ai')
}

async function loadName(latLng, lang) {
  let geodata = await get(
    'https://maps.googleapis.com/maps/api/geocode/json' +
      `?latlng=${latLng.latitude},${latLng.longitude}` +
      `&language=${lang}` +
      `&key=${process.env.GMAPS_TOKEN}`
  )
  if (!geodata.results[0]) {
    console.error(geodata)
    throw new MyError('Bad responce from Google')
  }
  let address = geodata.results[0].address_components
  let country = address.find(i => i.types.includes('country'))
  let city = address.find(i => i.types.includes('locality'))

  if (country.short_name === 'JP') {
    if (address.some(i => i.short_name === 'Tōkyō-to')) {
      city = { long_name: lang === 'ru' ? 'Токио' : 'Tokyo' }
    }
  } else if (country.short_name === 'US') {
    country = { long_name: lang === 'ru' ? 'США' : 'USA' }
  }
  if (!city) {
    city = address.find(i => i.types.includes('administrative_area_level_1'))
  }
  if (city.long_name === 'Barcelona' && lang === 'ru') {
    city.long_name = 'Барселона'
  }
  return { country: country.long_name, city: city.long_name }
}

async function loadNames(latLng) {
  let [ru, en] = await Promise.all([
    loadName(latLng, 'ru'),
    loadName(latLng, 'en')
  ])
  return { ...latLng, ru, en }
}

async function wasNotChanged(cur) {
  if (!existsSync(FILE)) return false
  let last = JSON.parse(await read(FILE))
  if (cur.latitude === last.latitude && cur.longitude === last.longitude) {
    process.stdout.write('Location was not changed\n')
    return true
  } else {
    return false
  }
}

async function save(location) {
  if (!existsSync(dirname(FILE))) {
    await mkdir(dirname(FILE))
  }
  await writeFile(FILE, JSON.stringify(location, null, 2))
}

loadLatLng()
  .then(async latLng => {
    if (await wasNotChanged(latLng)) return
    let location = await loadNames(latLng)
    process.stdout.write(`${location.en.city}, ${location.en.country}\n`)
    process.stdout.write(`${location.ru.city}, ${location.ru.country}\n`)
    await save(location)
  })
  .catch(MyError.print)
