#!/usr/bin/env node

let { writeFile, readFile, copyFile, unlink } = require('fs').promises
let { basename, join } = require('path')
let { nodeResolve } = require('@rollup/plugin-node-resolve')
let rollupCommonJS = require('@rollup/plugin-commonjs')
let { existsSync } = require('fs')
let { promisify } = require('util')
let combineMedia = require('postcss-combine-media-query')
let stripDebug = require('strip-debug')
let { terser } = require('rollup-plugin-terser')
let { rollup } = require('rollup')
let parcelCore = require('@parcel/core')
let posthtml = require('posthtml')
let postcss = require('postcss')
let globby = require('globby')
let crypto = require('crypto')
let dotenv = require('dotenv')
let zlib = require('zlib')
let del = require('del')

let Parcel = parcelCore.default
let gzip = promisify(zlib.gzip)

dotenv.config()

// Helpers

const A = 'a'.charCodeAt(0)
const ROOT = join(__dirname, '..')
const SRC = join(ROOT, 'src')
const DIST = join(ROOT, 'dist')
const NGINX = join(ROOT, 'nginx.conf')
const EARTH = join(SRC, 'earth')
const FAVICON = join(SRC, 'base', 'favicon.ico')
const LOCATION = join(__dirname, 'location', 'last.json')

function sha256(string) {
  return crypto.createHash('sha256').update(string, 'utf8').digest('base64')
}

function replaceAll(str, from, to) {
  return str.replace(new RegExp(from, 'g'), to)
}

async function findAsset(pattern) {
  let files = await globby(join(DIST, '**', pattern))
  return files[0]
}

// Steps

async function cleanDist() {
  await del(join(DIST, '*'))
}

async function buildAssets() {
  let options = {
    shouldPatchConsole: false,
    defaultConfig: join(ROOT, 'node_modules', '@parcel', 'config-default'),
    mode: 'production',
    defaultTargetOptions: {
      sourceMaps: false
    }
  }
  let bundler = new Parcel({
    ...options,
    entries: [join(SRC, 'en', 'index.pug'), join(SRC, 'ru', 'index.pug')]
  })
  await bundler.run()
  await unlink(await findAsset('en/index*.js'))
}

async function repackScripts() {
  let plugins = [nodeResolve(), rollupCommonJS(), terser()]
  let [indexBundle, workerBundle, workerFile, mapFile, hereFile] =
    await Promise.all([
      rollup({ input: join(SRC, 'index.js'), plugins }),
      rollup({ input: join(SRC, 'earth', 'worker.js'), plugins }),
      findAsset('worker*.js'),
      findAsset('map*.webp'),
      findAsset('here*.webp')
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
    .replace(/\w+\("\[as=script]"\)\.href/, `"/${basename(workerFile)}"`)
    .replace(/\w+\("[^"]+\[href\*=map]"\)\.href/, `"/${basename(mapFile)}"`)
    .replace(/\w+\("[^"]+\[href\*=here]"\)\.href/, `"/${basename(hereFile)}"`)
  worker = worker
    .replace(/\/\/ .*?\\n/g, '\\n')
    .replace(/\s\/\/.*?\\n/g, '\\n')
    .replace(/((\\t)+\\n)+/g, '')
    .replace(/(\\n)+/g, '\\n')
    .replace(/TypeError("[^"]+")/g, 'TypeError("TypeError")')
    .replace(/(\n)+/g, '\n')
    .replace(/{aliceblue[^}]+}/, '{}')
  worker = stripDebug(worker).toString()

  await writeFile(workerFile, worker)
  return js
}

async function repackStyles() {
  let cssFile = await findAsset('index*.css')
  let css = await readFile(cssFile).then(i => i.toString())
  await unlink(cssFile)

  let classes = {}
  let lastUsed = -1

  function cssPlugin(root) {
    root.walkRules(rule => {
      rule.selector = rule.selector.replace(/\.[\w-]+/g, str => {
        let kls = str.substr(1)
        if (!classes[kls]) {
          lastUsed += 1
          if (lastUsed === 26) lastUsed -= 26 + 7 + 25
          classes[kls] = String.fromCharCode(A + lastUsed)
        }
        return '.' + classes[kls]
      })
    })
  }

  css = postcss([cssPlugin, combineMedia]).process(css, { from: cssFile }).css
  return [css, classes]
}

async function copyImages() {
  let [mapFile, hereFile] = await Promise.all([
    findAsset('map*.webp'),
    findAsset('here*.webp')
  ])
  await Promise.all([
    copyFile(join(EARTH, 'here.png'), hereFile.replace('webp', 'png')),
    copyFile(join(EARTH, 'map.png'), mapFile.replace('webp', 'png')),
    copyFile(FAVICON, join(DIST, 'favicon.ico'))
  ])
}

async function prepareLocation() {
  let location = {}
  if (existsSync(LOCATION)) {
    location = JSON.parse(await readFile(LOCATION))
  }
  let simpleLocation = JSON.stringify({
    latitude: location.latitude,
    longitude: location.longitude
  })

  await Promise.all([writeFile(join(DIST, 'location.json'), simpleLocation)])
}

function updateClasses(js, classes) {
  for (let origin in classes) {
    let converted = classes[origin]
    if (origin.startsWith('earth') || origin.startsWith('globe')) {
      js = replaceAll(js, `".${origin}"`, `".${converted}"`)
    }
    if (origin.startsWith('is-')) {
      js = replaceAll(js, `"${origin}"`, `"${converted}"`)
    }
  }
  return js
}

async function updateCSP(js, css) {
  let nginx = await readFile(NGINX).then(i => i.toString())
  nginx = nginx
    .replace(/(style-src 'sha256-)[^']+'/g, `$1${sha256(css)}'`)
    .replace(/(script-src 'sha256-)[^']+'/g, `$1${sha256(js)}'`)
  await writeFile(NGINX, nginx)
}

async function updateHtml(js, css, classes) {
  let ignorePreload = { script: true, image: true }

  function htmlPlugin(tree) {
    tree.walk(i => {
      if (i.tag === 'link' && i.attrs.rel === 'stylesheet') {
        return [{ tag: 'style', content: [css] }]
      } else if (i.tag === 'link' && ignorePreload[i.attrs.as]) {
        return []
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

  async function processFile(lang) {
    let file = join(DIST, lang, 'index.html')
    let html = await readFile(file)
    html = posthtml()
      .use(htmlPlugin)
      .process(html.toString(), { sync: true }).html
    await writeFile(file, html)
    let compressed = await gzip(html, { level: 9 })
    await writeFile(file + '.gz', compressed)
  }

  await Promise.all([processFile('ru'), processFile('en')])
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
  await cleanDist()
  await buildAssets()
  let [js, [css, classes]] = await Promise.all([
    repackScripts(),
    repackStyles(),
    copyImages(),
    prepareLocation()
  ])
  js = updateClasses(js, classes)
  await Promise.all([
    updateCSP(js, css),
    updateHtml(js, css, classes),
    compressAssets()
  ])
}

build().catch(e => {
  if (e.stack) {
    process.stderr.write(e.stack + '\n')
  } else {
    process.stderr.write(e + '\n')
  }
  process.exit(1)
})
