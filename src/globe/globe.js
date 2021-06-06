import { showEarth } from '../earth/earth.js'
import { query } from '../query.js'

let saveData = navigator.connection && navigator.connection.saveData

if (window.innerWidth > 980 && !saveData) {
  showEarth()
} else {
  window.matchMedia('(min-width: 981px)').addListener(e => {
    if (e.matches) showEarth()
  })
}

query('.globe_location').addEventListener('click', () => {
  query('.globe').classList.toggle('is-open')
  showEarth()
})
