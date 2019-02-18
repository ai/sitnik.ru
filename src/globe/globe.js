let earth = require('../earth/earth.js')

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
  let address = geodata.results[0].formatted_address.split(', ')
  document.querySelector('[itemprop=addressLocality]').innerText = address[0]
  document.querySelector('[itemprop=addressCountry]').innerText = address[1]
})

if (window.innerWidth > 980) {
  earth[0]()
} else {
  window.addEventListener('resize', () => {
    if (window.innerWidth > 980) earth[0]()
  })
  document.querySelector('.globe_location').addEventListener('click', () => {
    document.querySelector('.globe').classList.toggle('is-open')
    earth[0]()
  })
}
