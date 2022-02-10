#!/usr/bin/env node

import { writeFile, readFile, copyFile, rm, mkdir } from 'fs/promises'
import { basename, join, dirname, extname } from 'path'
import { existsSync, ReadStream } from 'fs'
import { fileURLToPath } from 'url'
import { transformSync } from '@babel/core'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import rollupCommonJS from '@rollup/plugin-commonjs'
import { createHash } from 'crypto'
import { promisify } from 'util'
import postcssImport from 'postcss-import'
import combineMedia from 'postcss-combine-media-query'
import autoprefixer from 'autoprefixer'
import mediaMinMax from 'postcss-media-minmax'
import stripDebug from 'strip-debug'
import { minify } from 'terser'
import { terser } from 'rollup-plugin-terser'
import { rollup } from 'rollup'
import { globby } from 'globby'
import posthtml from 'posthtml'
import postcss from 'postcss'
import sugarss from 'sugarss'
import pxtorem from 'postcss-pxtorem'
import cssnano from 'cssnano'
import nested from 'postcss-nested'
import dotenv from 'dotenv'
import pico from 'picocolors'
import zlib from 'zlib'
import pug from 'pug'

import { cssCompressor } from './lib/css-compressor.js'

let gzip = promisify(zlib.gzip)

dotenv.config()

// Helpers

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')
const DIST = join(ROOT, 'dist')
const NGINX = join(ROOT, 'nginx.conf')
const LOCATION = join(ROOT, 'scripts', 'location', 'last.json')

function sha256(string) {
  return createHash('sha256').update(string, 'utf8').digest('base64')
}

function replaceAll(str, from, to) {
  return str.replace(new RegExp(from, 'g'), to)
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

async function loadLocation() {
  let location = {
    latitude: 40.7128,
    longitude: -74.006,
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
  let classes = {}
  let from = join(SRC, 'index.sss')
  let sss = await readFile(from)
  let result = await postcss([
    combineMedia(),
    mediaMinMax(),
    postcssImport(),
    nested(),
    pxtorem({
      selectorBlackList: ['html', '.photo'],
      rootValue: 20,
      propList: ['*']
    }),
    autoprefixer(),
    cssCompressor(classes),
    cssnano()
  ]).process(sss, { from, parser: sugarss, map: false })
  return [result.css, classes]
}

async function compileScripts(classes, images) {
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

  for (let origin in classes) {
    let converted = classes[origin]
    if (origin.startsWith('earth') || origin.startsWith('globe')) {
      js = replaceAll(js, `".${origin}"`, `".${converted}"`)
    }
    if (origin.startsWith('is-')) {
      js = replaceAll(js, `"${origin}"`, `"${converted}"`)
    }
  }

  await writeFile(join(DIST, workerFile), worker)
  return js
}

async function compileHtml(location, js, css, classes, images) {
  let isImage = /\.(webp|avif|ico|png|jpg)$/
  function htmlPlugin(tree) {
    tree.walk(i => {
      if (i.attrs) {
        for (let attr in i.attrs) {
          if (isImage.test(i.attrs[attr])) {
            let file = join(SRC, 'en', i.attrs[attr])
            if (!images[file]) {
              throw new Error('Unknown image ' + i.attrs[attr])
            }
            i.attrs[attr] = `/${images[file]}`
          }
        }
      }
      if (i.tag === 'link' && i.attrs.rel === 'stylesheet') {
        return [{ tag: 'style', content: [css] }]
      } else if (i.tag === 'script') {
        return {
          tag: 'script',
          content: js
        }
      } else if (i.attrs && i.attrs.class) {
        return {
          tag: i.tag,
          content: i.content,
          attrs: {
            ...i.attrs,
            class: i.attrs.class
              .split(' ')
              .map(kls => {
                if (!classes[kls]) {
                  process.stderr.write(`Unused class .${kls}\n`)
                  process.exit(1)
                }
                return classes[kls]
              })
              .join(' ')
          }
        }
      } else {
        return i
      }
    })
  }

  await Promise.all(
    ['en', 'es', 'ru'].map(async lang => {
      let pugFile = join(SRC, lang, 'index.pug')
      let pugSource = await readFile(pugFile)
      let pugFn = pug.compile(pugSource.toString(), { filename: pugFile })
      let html = pugFn({ location })

      html = posthtml()
        .use(htmlPlugin)
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
  let [location] = await Promise.all([
    task('Load location', () => loadLocation()),
    task('Clean dist/', () => cleanDist())
  ])
  let [[css, classes], images] = await Promise.all([
    task('Compile styles', () => compileStyles()),
    task('Copy images', () => copyImages()),
    task('Save location cache', () => saveLocationCache(location))
  ])
  let js = await task('Bundle scripts', () => compileScripts(classes, images))
  await Promise.all([
    task('Compile HTML', () => compileHtml(location, js, css, classes, images)),
    task('Update nginx.conf', () => updateCSP(js, css))
  ])
  if (process.env.NODE_ENV === 'production') {
    await task('Precompess assets', () => compressAssets())
  }
}

build().catch(e => {
  if (e.stack) {
    process.stderr.write(pico.red(e.stack) + '\n')
  } else {
    process.stderr.write(pico.red(e) + '\n')
  }
  process.exit(1)
})
