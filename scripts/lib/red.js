let red
try {
  red = require('colorette').red
} catch {}

if (red) {
  module.exports = red
} else {
  module.exports = str => str
}
