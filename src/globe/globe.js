function get (url) {
  return fetch(url).then(res => res.json())
}

function loadEarth (cb) {
  let script = document.createElement('script')
  script.async = true
  script.onload = cb
  script.src = document.querySelector('[as=script]').href
  document.head.appendChild(script)
}

let location

get('https://evilmartians.com/locations/ai').then(data => {
  if (window.sL) window.sL(data)
  location = data
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

window.onload = function () {
  setTimeout(() => {
    loadEarth(() => {
      if (location) window.sL(location)
    })
  }, 1)
}
