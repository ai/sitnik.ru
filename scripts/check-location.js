#!/usr/bin/env node

let MyError = require('./lib/my-error')
let get = require('./lib/get')

async function check () {
  let [last, cur] = await Promise.all([
    get('https://evilmartians.com/locations/ai'),
    get('https://sitnik.ru/location.json')
  ])
  if (cur.latitude !== last.latitude || cur.longitude !== last.longitude) {
    process.stdout.write('::set-output name=updated::1\n')
  }
}

check().catch(MyError.print)
