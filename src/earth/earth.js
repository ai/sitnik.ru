let worker, initializing, location, earthLoaded

function initEarth (canvas, offscreen) {
  earthLoaded = true
  let loading = document.querySelector('.earth_loading')

  let mapUrl = document.querySelector('[as=image][href*=map]').href
  let hereUrl = document.querySelector('[as=image][href*=here]').href

  worker.onmessage = () => {
    canvas.style.opacity = 1
    loading.remove()
  }

  worker.postMessage([
    'init',
    offscreen,
    canvas.clientWidth,
    canvas.clientHeight,
    window.devicePixelRatio,
    mapUrl,
    hereUrl
  ], [offscreen])

  window.addEventListener('resize', () => {
    worker.postMessage(['resize', canvas.clientWidth, canvas.clientHeight])
  })

  if (location) setLocation(location)

  // Control

  let rotateStart

  function move (x, y) {
    worker.postMessage(['move', rotateStart, [x, y]])
    rotateStart = [x, y]
  }

  function mouseMove (e) {
    move(e.clientX, e.clientY)
  }

  function mouseUp () {
    document.removeEventListener('mousemove', mouseMove, false)
    document.removeEventListener('mouseup', mouseUp, false)
  }

  canvas.addEventListener('mousedown', e => {
    if (e.button === 0) { // left
      rotateStart = [e.clientX, e.clientY]
      e.preventDefault()
      document.addEventListener('mousemove', mouseMove, false)
      document.addEventListener('mouseup', mouseUp, false)
    }
  })

  if (window.innerWidth > 980) {
    canvas.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        rotateStart = [e.touches[0].pageX, e.touches[0].pageY]
      }
    }, { passive: true })
    canvas.addEventListener('touchmove', e => {
      if (e.touches.length === 1) {
        move(e.touches[0].pageX, e.touches[0].pageY)
      }
    }, { passive: true })
  } else {
    canvas.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        e.preventDefault()
        rotateStart = [e.touches[0].pageX, e.touches[0].pageY]
      }
    })
    canvas.addEventListener('touchmove', e => {
      if (e.touches.length === 1) {
        e.preventDefault()
        move(e.touches[0].pageX, e.touches[0].pageY)
      }
    })
  }
}

function init () {
  if (initializing) return
  initializing = true

  let canvas = document.querySelector('.earth_canvas')
  let workerUrl = document.querySelector('[as=script]').href

  if (canvas.transferControlToOffscreen) {
    worker = new Worker(workerUrl)
    initEarth(canvas, canvas.transferControlToOffscreen())
  } else {
    worker = {
      postMessage: data => {
        window.wS({ data })
      }
    }
    window.wM = () => {
      worker.onmessage()
    }
    let script = document.createElement('script')
    script.src = workerUrl
    script.async = true
    script.onload = () => {
      initEarth(canvas, canvas)
    }
    document.head.appendChild(script)
  }
}

function setLocation (l) {
  if (earthLoaded) {
    worker.postMessage(['here', l.latitude, l.longitude])
  } else {
    location = l
  }
}

module.exports = [init, setLocation]
