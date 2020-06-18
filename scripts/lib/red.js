let kleur
try {
  kleur = require('kleur')
} catch {}

if (kleur) {
  module.exports = kleur.red
} else {
  module.exports = str => str
}
