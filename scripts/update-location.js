#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import { LOCATION } from './lib/dirs.js'
import { get } from './lib/get.js'
import { MyError } from './lib/my-error.js'
import { read } from './lib/read.js'

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
    throw new MyError('Bad response from Google')
  }
  let address = geodata.results[0].address_components
  let country = address.find(i => i.types.includes('country'))
  let city = address.find(i => i.types.includes('locality'))

  if (!city) {
    city = address.find(i => i.types.includes('administrative_area_level_1'))
  }
  if (city.long_name === 'Barcelona' && lang === 'ru') {
    city.long_name = 'Барселона'
  }
  return { city: city.long_name, country: country.long_name }
}

async function loadNames(latLng) {
  let [ru, es, en] = await Promise.all([
    loadName(latLng, 'ru'),
    loadName(latLng, 'es'),
    loadName(latLng, 'en')
  ])
  return { ...latLng, en, es, ru }
}

async function wasNotChanged(cur) {
  if (!existsSync(LOCATION)) return false
  let last = JSON.parse(await read(LOCATION))
  if (cur.latitude === last.latitude && cur.longitude === last.longitude) {
    process.stdout.write('Location was not changed\n')
    return true
  } else {
    return false
  }
}

async function save(location) {
  if (!existsSync(dirname(LOCATION))) {
    await mkdir(dirname(LOCATION))
  }
  await writeFile(LOCATION, JSON.stringify(location, null, 2))
}

loadLatLng()
  .then(async latLng => {
    if (await wasNotChanged(latLng)) return
    let location = await loadNames(latLng)
    process.stdout.write(`${location.en.city}, ${location.en.country}\n`)
    process.stdout.write(`${location.es.city}, ${location.es.country}\n`)
    process.stdout.write(`${location.ru.city}, ${location.ru.country}\n`)
    await save(location)
  })
  .catch(MyError.print)
