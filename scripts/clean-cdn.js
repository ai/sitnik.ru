#!/usr/bin/env node

let dotenv = require('dotenv')

let callCloudflare = require('./lib/call-cloudflare')
let MyError = require('./lib/my-error')

dotenv.config()

async function cleanCache () {
  await callCloudflare('purge_cache', {
    files: ['https://sitnik.ru/ru/', 'https://sitnik.ru/en/']
  })
}

cleanCache().catch(MyError.print)
