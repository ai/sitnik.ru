const A = 'a'.charCodeAt(0)

const COMPRESSED = Symbol('compressed')

export function cssCompressor(classes) {
  let lastClass = -1
  let lastCustom = -1
  let customs = {}

  return {
    postcssPlugin: 'cssCompressor',

    Rule(rule) {
      if (rule[COMPRESSED]) return
      rule[COMPRESSED] = true

      rule.selector = rule.selector.replace(/\.[\w-]+/g, klsSelector => {
        let kls = klsSelector.substr(1)
        if (!classes[kls]) {
          lastClass += 1
          if (lastClass === 26) lastClass -= 26 + 7 + 25
          classes[kls] = String.fromCharCode(A + lastClass)
        }
        return '.' + classes[kls]
      })
    },

    Declaration(decl) {
      if (decl[COMPRESSED]) return
      decl[COMPRESSED] = true

      if (decl.variable) {
        if (!customs[decl.prop]) {
          lastCustom += 1
          customs[decl.prop] = '--' + String.fromCharCode(A + lastCustom)
        }
        decl.prop = customs[decl.prop]
      } else if (decl.value.includes('var(')) {
        decl.value = decl.value.replace(/--[\w-]+/, name => {
          if (!customs[name]) {
            process.stderr.write(
              `Custom Properties ${name} without definition\n`
            )
            process.exit(1)
          }
          return customs[name]
        })
      }
    }
  }
}

cssCompressor.postcss = true
