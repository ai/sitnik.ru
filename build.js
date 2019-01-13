#!/usr/bin/env node

let { promisify } = require('util')
let posthtml = require('posthtml')
let Bundler = require('parcel-bundler')
let path = require('path')
let fs = require('fs')

let writeFile = promisify(fs.writeFile)
let readFile = promisify(fs.readFile)
let unlink = promisify(fs.unlink)

let bundler = new Bundler(path.join(__dirname, 'src', 'index.pug'), {
  scopeHoist: true,
  sourceMaps: false
})

function findAssets (bundle) {
  return Array.from(bundle.childBundles).reduce((all, i) => {
    return all.concat(findAssets(i))
  }, [bundle.name])
}

async function build () {
  let bundle = await bundler.bundle()

  let assets = findAssets(bundle)

  let cssFile = assets.find(i => path.extname(i) === '.css')
  let srcJsFile = assets.find(i => /src\..*\.js/.test(i))

  let css = (await readFile(cssFile)).toString()
  let srcJs = (await readFile(srcJsFile)).toString()

  await Promise.all([unlink(cssFile), unlink(srcJsFile)])

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
          content: srcJs.toString()
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
  }

  assets.filter(i => path.extname(i) === '.html').forEach(async i => {
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
