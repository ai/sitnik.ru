const A = 'a'.charCodeAt(0)

const COMPRESSED = Symbol('compressed')

export function cssCompressor(classes) {
  let lastUsed = -1
  return {
    postcssPlugin: 'cssCompressor',
    Rule(rule) {
      if (rule[COMPRESSED]) return
      rule[COMPRESSED] = true

      rule.selector = rule.selector.replace(/\.[\w-]+/g, str => {
        let kls = str.substr(1)
        if (!classes[kls]) {
          lastUsed += 1
          if (lastUsed === 26) lastUsed -= 26 + 7 + 25
          classes[kls] = String.fromCharCode(A + lastUsed)
        }
        return '.' + classes[kls]
      })
    }
  }
}

cssCompressor.postcss = true
