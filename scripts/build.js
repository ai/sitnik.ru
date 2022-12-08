#!/usr/bin/env node

import { writeFile, readFile, copyFile, rm, mkdir } from 'fs/promises'
import { basename, join, extname } from 'path'
import { existsSync, ReadStream } from 'fs'
import postcssLoadConfig from 'postcss-load-config'
import { transformSync } from '@babel/core'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import rollupCommonJS from '@rollup/plugin-commonjs'
import { createHash } from 'crypto'
import { promisify } from 'util'
import stripDebug from 'strip-debug'
import { minify } from 'terser'
import { terser } from 'rollup-plugin-terser'
import { rollup } from 'rollup'
import { globby } from 'globby'
import posthtml from 'posthtml'
import postcss from 'postcss'
import dotenv from 'dotenv'
import pico from 'picocolors'
import zlib from 'zlib'
import pug from 'pug'

import { SRC, DIST, LOCATION, NGINX, COUNTRIES } from './lib/dirs.js'
import { htmlCompressor } from './lib/html-compressor.js'
import { MyError } from './lib/my-error.js'

let gzip = promisify(zlib.gzip)

dotenv.config()

// Helpers

function sha256(string) {
  return createHash('sha256').update(string, 'utf8').digest('base64')
}

let hashCache = {}

async function hashFile(file) {
  if (!hashCache[file]) {
    let hash = createHash('sha1')
    let stream = ReadStream(file)
    stream.on('data', data => {
      hash.update(data)
    })
    await new Promise(resolve => {
      stream.on('end', () => {
        hashCache[file] = hash.digest('hex').slice(0, 8)
        resolve()
      })
    })
  }
  return hashCache[file]
}

async function assetName(file) {
  let hash = await hashFile(file)
  let ext = extname(file)
  return basename(file, ext) + '.' + hash + ext
}

async function task(text, fn) {
  let start = Date.now()
  let result = await fn()
  let ms = Date.now() - start
  process.stdout.write(
    pico.green('✔') + ' ' + text + ' ' + pico.gray(ms + ' ms') + '\n'
  )
  return result
}

// Steps

async function cleanDist() {
  await rm(DIST, { recursive: true, force: true })
  await mkdir(DIST)
}

async function loadVisited() {
  let countries = Object.keys(JSON.parse(await readFile(COUNTRIES)))
  return { countries }
}

async function loadLocation() {
  let location = {
    latitude: 41.38,
    longitude: 2.18,
    es: { country: 'España', city: 'Barcelona' },
    en: { country: 'Spain', city: 'Barcelona' },
    ru: { country: 'Испания', city: 'Барселона' }
  }
  if (existsSync(LOCATION)) {
    location = JSON.parse(await readFile(LOCATION))
  }
  return location
}

async function copyImages() {
  let images = {}
  let from = await globby(join(SRC, '**', '*.{webp,avif,ico,png,jpg}'))
  await Promise.all(
    from.map(async file => {
      let name = basename(file)
      if (!file.endsWith('favicon.ico') && !file.endsWith('andreysitnik.jpg')) {
        let hash
        if (name === 'here.png' || name === 'map.png') {
          hash = await hashFile(file.replace(/\.png$/, '.webp'))
        } else {
          hash = await hashFile(file)
        }
        let ext = extname(name)
        name = basename(file, ext) + '.' + hash + ext
      }
      images[file] = name
      await copyFile(file, join(DIST, name))
    })
  )
  return images
}

async function compileStyles() {
  let from = join(SRC, 'index.css')
  let sss = await readFile(from)
  let { plugins, options } = await postcssLoadConfig()
  let result = await postcss(plugins).process(sss, {
    ...options,
    from,
    map: false
  })
  for (let warn of result.warnings()) {
    process.stderr.write(pico.yellow(warn.toString()) + '\n')
  }
  return [result.css]
}

async function compileScripts(images) {
  let plugins = [nodeResolve(), rollupCommonJS(), terser()]
  let mapFile = images[join(SRC, 'earth', 'map.webp')]
  let hereFile = images[join(SRC, 'earth', 'here.webp')]
  let workerFile = await assetName(join(SRC, 'earth', 'worker.js'))
  let [indexBundle, workerBundle] = await Promise.all([
    rollup({ input: join(SRC, 'index.js'), plugins }),
    rollup({ input: join(SRC, 'earth', 'worker.js'), plugins })
  ])
  let [indexOutput, workerOutput] = await Promise.all([
    indexBundle.generate({ format: 'iife', strict: false }),
    workerBundle.generate({ format: 'iife', strict: false })
  ])

  let js = indexOutput.output[0].code.trim()
  let worker = workerOutput.output[0].code.trim()

  js = js
    .replace(/var /g, 'let ')
    .replace(/function\s*\((\w+)\)/g, '$1=>')
    .replace(/}\(\);$/, '}()')
    .replace(/\w+\("\[as=script]"\)\.href/, `"/${workerFile}"`)
    .replace(/\w+\("[^"]+\[href\*=map]"\)\.href/, `"/${mapFile}"`)
    .replace(/\w+\("[^"]+\[href\*=here]"\)\.href/, `"/${hereFile}"`)
  worker = worker
    .replace(/\/\/ .*?\\n/g, '\\n')
    .replace(/\s\/\/.*?\\n/g, '\\n')
    .replace(/((\\t)+\\n)+/g, '')
    .replace(/(\\n)+/g, '\\n')
    .replace(/TypeError("[^"]+")/g, 'TypeError("TypeError")')
    .replace(/(\n)+/g, '\n')
    .replace(/{aliceblue[^}]+}/, '{}')
  worker = transformSync(worker, { plugins: [stripDebug] }).code
  worker = (await minify(worker, { sourceMap: false })).code

  await writeFile(join(DIST, workerFile), worker)
  return js
}

async function compileHtml(visited, location, js, css, images) {
  await Promise.all(
    ['en', 'es', 'ru'].map(async lang => {
      let pugFile = join(SRC, lang, 'index.pug')
      let pugSource = await readFile(pugFile)
      let pugFn = pug.compile(pugSource.toString(), { filename: pugFile })
      function pluralize(count, one, other, few) {
        let form = new Intl.PluralRules(lang).select(count)
        if (form === 'one') {
          return one
        } else if (form === 'few') {
          return few
        } else {
          return other
        }
      }
      let html = pugFn({ location, visited, pluralize })

      html = posthtml()
        .use(htmlCompressor(js, images, css))
        .process(html.toString(), { sync: true }).html

      await mkdir(join(DIST, lang))
      let file = join(DIST, lang, 'index.html')
      await writeFile(file, html)
      if (process.env.NODE_ENV === 'production') {
        let compressed = await gzip(html, { level: 9 })
        await writeFile(file + '.gz', compressed)
      }
    })
  )
}

async function saveLocationCache(location) {
  let simpleLocation = JSON.stringify({
    latitude: location.latitude,
    longitude: location.longitude
  })
  await Promise.all([writeFile(join(DIST, 'location.json'), simpleLocation)])
}

async function updateCSP(js, css) {
  let nginx = await readFile(NGINX)
  nginx = nginx
    .toString()
    .replace(/(style-src 'sha256-)[^']+'/g, `$1${sha256(css)}'`)
    .replace(/(script-src 'sha256-)[^']+'/g, `$1${sha256(js)}'`)
  await writeFile(NGINX, nginx)
}

async function compressAssets() {
  let files = await globby(join(DIST, '*.{js,ico,json}'))
  await Promise.all(
    files
      .filter(i => existsSync(i))
      .map(async file => {
        let content = await readFile(file)
        let compressed = await gzip(content, { level: 9 })
        await writeFile(file + '.gz', compressed)
      })
  )
}

async function build() {
  let [visited, location] = await Promise.all([
    task('Load visited countries', () => loadVisited()),
    task('Load location', () => loadLocation()),
    task('Clean dist/', () => cleanDist())
  ])
  let [[css], images] = await Promise.all([
    task('Compile styles', () => compileStyles()),
    task('Copy images', () => copyImages()),
    task('Save location cache', () => saveLocationCache(location))
  ])
  let js = await task('Bundle scripts', () => compileScripts(images))
  await Promise.all([
    task('Compile HTML', () => compileHtml(visited, location, js, css, images)),
    task('Update nginx.conf', () => updateCSP(js, css))
  ])
  if (process.env.NODE_ENV === 'production') {
    await task('Precompess assets', () => compressAssets())
  }
}

build().catch(MyError.print)
