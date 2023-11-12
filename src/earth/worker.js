import {
  AmbientLight,
  CanvasTexture,
  Color,
  ColorManagement,
  DirectionalLight,
  ImageBitmapLoader,
  ImageLoader,
  LinearSRGBColorSpace,
  Mesh,
  MeshBasicMaterial,
  MeshPhongMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Spherical,
  Sprite,
  SpriteMaterial,
  Vector3,
  WebGLRenderer
} from 'three'

import visited from './dots.js'

const IS_WORKER = typeof window !== 'object'
const RADIUS = 0.765 * 0.88
const PI2 = 2 * Math.PI

ColorManagement.enabled = false

// Base

let renderer
let scene = new Scene()
let camera = new PerspectiveCamera(45, 1, 0.01, 1000)

let loader
if (IS_WORKER) {
  loader = new ImageBitmapLoader()
} else {
  loader = new ImageLoader()
}

let canvasHeight, finishLoading
let delta = new Spherical()

setPosition(camera.position, 2, 20, 0)
let distanceToEdge = camera.position.distanceTo(new Vector3(0, RADIUS, 0))

// Helpers

function setPosition(position, radius, latitude, longitude) {
  let phi = (90 - latitude) * (Math.PI / 180)
  let theta = (longitude + 180) * (Math.PI / 180)

  position.x = -radius * Math.sin(phi) * Math.cos(theta)
  position.z = radius * Math.sin(phi) * Math.sin(theta)
  position.y = radius * Math.cos(phi)
}

let initialized = false
let loaded = 0

function load() {
  loaded += 1
  if (loaded === 2) {
    renderer.render(scene, camera)
    finishLoading(1)
    initialized = true
    requestAnimationFrame(rotate)
  }
}

function move(start, end) {
  delta.setFromVector3(camera.position)

  delta.theta -= (PI2 * (end[0] - start[0])) / canvasHeight / 3
  delta.phi -= (PI2 * (end[1] - start[1])) / canvasHeight / 3

  delta.makeSafe()
  camera.position.setFromSpherical(delta)
  camera.lookAt(0, 0, 0)

  let distanceToHere = camera.position.distanceTo(here.position)
  here.material.depthTest = distanceToHere > distanceToEdge

  if (initialized) renderer.render(scene, camera)
}

// Scene

scene.background = new Color(0xffffff)

let sphere = new Mesh(
  new SphereGeometry(RADIUS, 64, 64),
  new MeshPhongMaterial()
)
scene.add(sphere)

let here = new Sprite(new SpriteMaterial())
here.material.depthTest = false
here.scale.set(0.1, 0.1, 1)
here.center.set(0.5, 0)
scene.add(here)

visited.forEach(i => {
  let dot = new Mesh(
    new SphereGeometry(0.004, 8),
    new MeshBasicMaterial({
      color: new Color(0xffffff)
    })
  )
  setPosition(dot.position, RADIUS, i[0], i[1])
  scene.add(dot)
})

// Light

scene.add(new AmbientLight(0x909090))

let light = new DirectionalLight(0x4f4f4f, 1)
light.position.set(1, 0, 1)
scene.add(light)

function moveSun() {
  let now = new Date()
  let solstice = new Date(now.getFullYear() + '-06-21 00:00:00')
  let days = (now - solstice) / (1000 * 60 * 60 * 24)
  let sunLat = 23.44 * Math.cos((2 * Math.PI * days) / 365.26)
  let sunLong = 180 - 15 * (now.getUTCHours() + now.getMinutes() / 60)
  setPosition(light.position, 2, sunLat, sunLong)
}

moveSun()
setInterval(moveSun, 30 * 60 * 1000)

// Auto-rotate on the start

let rotating = true
let prevRotate = Date.now()
function rotate() {
  if (!rotating) return
  let delay = Date.now() - prevRotate
  move([0, 0], [-delay / 100, 0])
  prevRotate = Date.now()
  requestAnimationFrame(rotate)
}

// Messages

let commands = {
  init(
    canvas,
    width,
    height,
    pixelRatio,
    mapUrl,
    hereUrl,
    isWebP,
    isDark,
    latitude,
    longitude
  ) {
    if (!canvas.style) canvas.style = { height, width }

    renderer = new WebGLRenderer({ antialias: true, canvas })
    renderer.outputColorSpace = LinearSRGBColorSpace
    renderer.setPixelRatio(pixelRatio)
    renderer.setSize(width, height)
    canvasHeight = height

    if (!isWebP) {
      mapUrl = mapUrl.replace('webp', 'png')
      hereUrl = hereUrl.replace('webp', 'png')
    }

    if (isDark) {
      scene.background = new Color(0x333333)
    }

    loader.load(mapUrl, mapImage => {
      sphere.material.map = new CanvasTexture(
        mapImage,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        8
      )
      sphere.material.map.flipY = false
      load()
    })

    loader.load(hereUrl, hereImage => {
      here.material.map = new CanvasTexture(hereImage)
      here.material.map.flipY = false
      load()
    })

    setPosition(here.position, RADIUS, latitude, longitude)
    setPosition(camera.position, 2, latitude > 0 ? 20 : -20, longitude)
    camera.lookAt(0, 0, 0)
  },

  move(start, end) {
    if (rotating) rotating = false
    move(start, end)
  },

  resize(width, height) {
    renderer.setSize(width, height)
    canvasHeight = height
    if (initialized) renderer.render(scene, camera)
  }
}

// Main

function onMessage(e) {
  commands[e.data[0]].apply(null, e.data.slice(1))
}

if (IS_WORKER) {
  onmessage = onMessage
  finishLoading = postMessage
} else {
  window.wS = data => {
    onMessage({ data })
  }
  finishLoading = window.wM
}
