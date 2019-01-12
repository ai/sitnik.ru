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

window.onload = function () {
  Promise.all([
    loadEarth(),
    fetch('https://evilmartians.com/locations/ai').then(res => res.json())
  ]).then(([showLocation, location]) => {
    showLocation(location)
  })
}
