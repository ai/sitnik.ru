function get (url) {
  return fetch(url).then(res => res.json())
}

let location

function loadEarth () {
  let script = document.createElement('script')
  script.async = true
  script.onload = () => {
    if (location) window.sL(location)
  }
  script.src = document.querySelector('[as=script]').href
  document.head.appendChild(script)
}

get('//evilmartians.com/locations/ai').then(data => {
  if (window.sL) window.sL(data)
  location = data
  return get('//maps.googleapis.com/maps/api/geocode/json' +
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
  window.addEventListener('load', () => {
    setTimeout(loadEarth, 1)
  })
} else {
  document.querySelector('.globe_location').addEventListener('click', () => {
    document.querySelector('.globe').classList.toggle('is-open')
    if (!window.sL) loadEarth()
  })
}
