#!/usr/bin/env node

let { writeFile, readFile, copyFile, unlink } = require('fs').promises
let { basename, extname, join } = require('path')
let stripDebug = require('strip-debug')
let posthtml = require('posthtml')
let mqpacker = require('css-mqpacker')
let Bundler = require('parcel-bundler')
let postcss = require('postcss')
let crypto = require('crypto')

const A = 'a'.charCodeAt(0)
const DIST = join(__dirname, 'dist')
const NGINX = join(__dirname, 'nginx.conf')
const EARTH = join(__dirname, 'src', 'earth')
const FAVICON = join(__dirname, 'src', 'base', 'favicon.ico')
const ROOT_INDEX = join(DIST, 'index.html')

function findAssets (bundle) {
  return Array.from(bundle.childBundles).reduce((all, i) => {
    return all.concat(findAssets(i))
  }, [bundle.name])
}

function sha256 (string) {
  return crypto.createHash('sha256').update(string, 'utf8').digest('base64')
}

function replaceAll (str, from, to) {
  return str.replace(new RegExp(from, 'g'), to)
}

let bundler = new Bundler(join(__dirname, 'src', 'index.pug'), {
  sourceMaps: false
})

let bundlerJs = new Bundler(join(__dirname, 'src', 'index.js'), {
  scopeHoist: true,
  sourceMaps: false
})

async function build () {
  await bundlerJs.bundle()
  let bundle = await bundler.bundle()
  await unlink(ROOT_INDEX)

  let assets = findAssets(bundle)

  let jsFile = join(DIST, 'index.js')
  let cssFile = assets.find(i => extname(i) === '.css')
  let mapFile = assets.find(i => /map\..*\.webp/.test(i))
  let hereFile = assets.find(i => /here\..*\.webp/.test(i))
  let srcJsFile = assets.find(i => /src\..*\.js/.test(i))
  let workerFile = assets.find(i => /worker\..*\.js/.test(i))

  let [css, js, worker, nginx] = await Promise.all([
    readFile(cssFile).then(i => i.toString()),
    readFile(jsFile).then(i => i.toString()),
    readFile(workerFile).then(i => i.toString()),
    readFile(NGINX).then(i => i.toString()),
    copyFile(join(EARTH, 'here.png'), hereFile.replace('webp', 'png')),
    copyFile(join(EARTH, 'map.png'), mapFile.replace('webp', 'png')),
    copyFile(FAVICON, join(DIST, 'favicon.ico')),
    unlink(srcJsFile)
  ])

  js = js
    .replace('function () ', '()=>')
    .replace(/};}\)\(\);$/, '}})()')
    .replace(/\w+\("\[as=script]"\)\.href/, `"/${ basename(workerFile) }"`)
    .replace(/\w+\("[^"]+\[href\*=map]"\)\.href/, `"/${ basename(mapFile) }"`)
    .replace(/\w+\("[^"]+\[href\*=here]"\)\.href/, `"/${ basename(hereFile) }"`)
  worker = worker
    .replace(/\/\/.*?\\n/g, '\\n')
    .replace(/((\\t)+\\n)+/g, '')
    .replace(/(\\n)+/g, '\\n')
    .replace(/(\n)+/g, '\n')
    .replace(/\{aliceblue[^}]+\}/, '{}')
    .replace(/Object.\w+\(\w+,"__esModule",{value:!0}\)(,?)/g, 'exports._E=1$1')
    .replace(/(\w).__esModule/, '$1._E')
    .replace(/"use strict";/g, '')
  worker = stripDebug(worker)

  await Promise.all([
    writeFile(workerFile, worker),
    unlink(cssFile),
    unlink(jsFile)
  ])

  let classes = { }
  let lastUsed = -1

  function cssPlugin (root) {
    root.walkRules(rule => {
      rule.selector = rule.selector.replace(/\.[\w_-]+/g, str => {
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

  css = postcss([cssPlugin, mqpacker]).process(css, { from: cssFile }).css

  for (let origin in classes) {
    let converted = classes[origin]
    if (origin.startsWith('earth') || origin.startsWith('globe')) {
      js = replaceAll(js, `".${ origin }"`, `".${ converted }"`)
    }
    if (origin.startsWith('is-')) {
      js = replaceAll(js, `"${ origin }"`, `"${ converted }"`)
    }
  }

  nginx = nginx
    .replace(/(style-src 'sha256-)[^']+'/g, `$1${ sha256(css) }'`)
    .replace(/(script-src 'sha256-)[^']+'/g, `$1${ sha256(js) }'`)
  await writeFile(NGINX, nginx)

  function htmlPlugin (tree) {
    tree.match({ tag: 'link', attrs: { rel: 'stylesheet' } }, () => {
      return { tag: 'style', content: css }
    })
    tree.match({ tag: 'link', attrs: { rel: 'preload' } }, i => {
      if (i.attrs.as === 'script' || i.attrs.as === 'image') {
        return false
      } else {
        return i
      }
    })
    tree.match({ tag: 'script' }, i => {
      if (i.attrs.src && i.attrs.src.includes('/src.')) {
        return {
          tag: 'script',
          content: js
        }
      } else {
        return i
      }
    })
    tree.match({ tag: 'a', attrs: { href: /^\/\w\w\/index.html$/ } }, i => {
      return {
        tag: 'a',
        content: i.content,
        attrs: {
          ...i.attrs,
          href: i.attrs.href.replace('index.html', '')
        }
      }
    })
    tree.match({ attrs: { class: true } }, i => {
      return {
        tag: i.tag,
        content: i.content,
        attrs: {
          ...i.attrs,
          class: i.attrs.class.split(' ').map(kls => {
            if (!classes[kls]) {
              process.stderr.write(`Unused class .${ kls }\n`)
              process.exit(1)
            }
            return classes[kls]
          }).join(' ')
        }
      }
    })
  }

  assets
    .filter(i => extname(i) === '.html' && i !== ROOT_INDEX)
    .forEach(async i => {
      let html = await readFile(i)
      await writeFile(i, posthtml()
        .use(htmlPlugin)
        .process(html, { sync: true })
        .html)
    })
}

build().catch(e => {
  process.stderr.write(e.stack + '\n')
  process.exit(1)
})
