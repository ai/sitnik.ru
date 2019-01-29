#!/usr/bin/env node

let { promisify } = require('util')
let posthtml = require('posthtml')
let postcss = require('postcss')
let Bundler = require('parcel-bundler')
let path = require('path')
let fs = require('fs')

let writeFile = promisify(fs.writeFile)
let readFile = promisify(fs.readFile)
let unlink = promisify(fs.unlink)

const A = 'a'.charCodeAt(0)

let bundler = new Bundler(path.join(__dirname, 'src', 'index.pug'), {
  sourceMaps: false
})

let bundlerJs = new Bundler(path.join(__dirname, 'src', 'index.js'), {
  scopeHoist: true,
  sourceMaps: false
})

function findAssets (bundle) {
  return Array.from(bundle.childBundles).reduce((all, i) => {
    return all.concat(findAssets(i))
  }, [bundle.name])
}

async function build () {
  await bundlerJs.bundle()
  let bundle = await bundler.bundle()

  let assets = findAssets(bundle)

  let jsFile = path.join(__dirname, 'dist', 'index.js')
  let cssFile = assets.find(i => path.extname(i) === '.css')
  let srcJsFile = assets.find(i => /src\..*\.js/.test(i))

  let css = (await readFile(cssFile)).toString()
  let js = (await readFile(jsFile)).toString()
    .replace('function () ', 'function()')
    .replace(/};}\)\(\);$/, '}})()')

  await Promise.all([
    unlink(cssFile),
    unlink(srcJsFile),
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
          classes[kls] = String.fromCharCode(A + lastUsed)
        }
        return '.' + classes[kls]
      })
    })
  }

  css = postcss([cssPlugin]).process(css, { from: cssFile }).css

  function htmlPlugin (tree) {
    tree.match({ tag: 'link', attrs: { rel: 'stylesheet' } }, () => {
      return { tag: 'style', content: css.toString() }
    })
    tree.match({ tag: 'script' }, i => {
      if (i.content && i.content[0].indexOf('navigator.language') !== -1) {
        return {
          tag: 'script',
          content: i.content[0].replace('/index.html', '')
        }
      } else if (i.attrs.src && i.attrs.src.indexOf('/src.') !== -1) {
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
          href: i.attrs.href.replace('/index.html', '')
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

  assets.filter(i => path.extname(i) === '.html').forEach(async i => {
    let html = await readFile(i)
    await writeFile(i, posthtml()
      .use(htmlPlugin)
      .process(html, { sync: true })
      .html)
  })

  let earthJsFile = assets.find(i => /earth\..*\.js/.test(i))
  let earthJs = (await readFile(earthJsFile)).toString()
  for (let origin in classes) {
    if (origin.indexOf('globe_') !== -1) {
      earthJs = earthJs.replace(`".${ origin }"`, `".${ classes[origin] }"`)
    }
  }
  await writeFile(earthJsFile, earthJs)
}

build().catch(e => {
  process.stderr.write(e.stack + '\n')
  process.exit(1)
})
