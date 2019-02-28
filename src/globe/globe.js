let earth = require('../earth/earth.js')
let query = require('../query.js')

function get (url) {
  return fetch(url).then(res => res.json())
}

get('https://evilmartians.com/locations/ai').then(data => {
  earth[1](data)
  return get('https://maps.googleapis.com/maps/api/geocode/json' +
    '?latlng=' + data.latitude + ',' + data.longitude +
    '&language=' + document.documentElement.lang +
    '&result_type=locality' +
    '&key=AIzaSyDtN3EGVupACA_bqxQi-5r3iHLCzdeCfZc')
}).then(geodata => {
  let parts = geodata.results[0].formatted_address.split(', ')
  query('[itemprop=addressLocality]').innerText = parts[0]
  query('[itemprop=addressCountry]').innerText = parts[parts.length - 1]
})

let saveData = navigator.connection && navigator.connection.saveData

if (window.innerWidth > 980 || !saveData) {
  earth[0]()
} else {
  window.matchMedia("(min-width: 981px)").addListener((event) => {
    if (event.matches) {
      earth[0]()
    }
  })
}

query('.globe_location').addEventListener('click', () => {
  query('.globe').classList.toggle('is-open')
  earth[0]()
})
