let earth = require('../earth/earth.js')
let query = require('../query.js')

function get (url) {
  return fetch(url).then(res => res.json())
}

get('https://evilmartians.com/locations/ai').then(data => {
  get(
    'https://maps.googleapis.com/maps/api/geocode/json' +
    '?latlng=' + data.latitude + ',' + data.longitude +
    '&language=' + document.documentElement.lang +
    '&result_type=locality' +
    '&key=AIzaSyDtN3EGVupACA_bqxQi-5r3iHLCzdeCfZc'
  ).then(geodata => {
    earth[1](data)
    if (geodata.results[0]) {
      let parts = geodata.results[0].formatted_address
        .replace(/,\s+\d+/, '')
        .split(', ')
      query('[itemprop=addressLocality]').innerText = parts[0]
      query('[itemprop=addressCountry]').innerText = parts[parts.length - 1]
    } else {
      query('.globe_location').innerText = ' '
    }
  })
})

let saveData = navigator.connection && navigator.connection.saveData

if (window.innerWidth > 980 && !saveData) {
  earth[0]()
} else {
  window.matchMedia('(min-width: 981px)').addListener(e => {
    if (e.matches) earth[0]()
  })
}

query('.globe_location').addEventListener('click', () => {
  query('.globe').classList.toggle('is-open')
  earth[0]()
})
