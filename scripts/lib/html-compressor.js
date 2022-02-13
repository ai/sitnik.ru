import { join } from 'path'

import { SRC } from './dirs.js'

const IS_IMAGE = /\.(webp|avif|ico|png|jpg)$/

export function htmlCompressor(js, images, css) {
  return tree => {
    tree.walk(i => {
      if (i.attrs) {
        for (let attr in i.attrs) {
          if (IS_IMAGE.test(i.attrs[attr])) {
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
      } else {
        return i
      }
    })
  }
}
