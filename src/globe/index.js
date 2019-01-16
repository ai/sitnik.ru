function loadEarth () {
  return new Promise((resolve, reject) => {
    let script = document.createElement('script')
    script.async = true
    script.onerror = reject
    script.onload = function () {
      resolve(window.sL)
    }
    script.src = document.querySelector('link[as="script"]').href
    document.head.appendChild(script)
  })
}

function get (url) {
  return fetch(url).then(res => res.json())
}

window.onload = function () {
  Promise.all([
    loadEarth(),
    get('https://evilmartians.com/locations/ai')
  ]).then(([showLocation, location]) => {
    showLocation(location)
    return get('https://maps.googleapis.com/maps/api/geocode/json' +
      '?latlng=' + location.latitude + ',' + location.longitude +
      '&language=' + document.documentElement.lang +
      '&result_type=locality' +
      '&key=AIzaSyDtN3EGVupACA_bqxQi-5r3iHLCzdeCfZc')
  }).then(geodata => {
    let address = geodata.results[0].formatted_address.split(', ')
    document.querySelector('[itemprop=addressLocality]').innerText = address[0]
    document.querySelector('[itemprop=addressCountry]').innerText = address[1]
  }).catch(e => console.error(e))
}
