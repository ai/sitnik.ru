let { MeshPhongMaterial } = require('three/src/materials/MeshPhongMaterial')
let { MeshBasicMaterial } = require('three/src/materials/MeshBasicMaterial')
let { PerspectiveCamera } = require('three/src/cameras/PerspectiveCamera')
let { DirectionalLight } = require('three/src/lights/DirectionalLight')
let { SphereGeometry } = require('three/src/geometries/SphereGeometry')
let { WebGLRenderer } = require('three/src/renderers/WebGLRenderer')
let { TextureLoader } = require('three/src/loaders/TextureLoader')
let { AmbientLight } = require('three/src/lights/AmbientLight')
let OrbitControls = require('three-orbitcontrols')
let { Scene } = require('three/src/scenes/Scene')
let { Color } = require('three/src/math/Color')
let { Mesh } = require('three/src/objects/Mesh')

const RADIUS = 0.765

// DOM

let loading = document.querySelector('.globe_loading')
let div = document.querySelector('.globe_earth')

let mapUrl = document.querySelector('[as=image]').href

// Base

let renderer = new WebGLRenderer()
let scene = new Scene()
let camera = new PerspectiveCamera(45, 1, 0.01, 1000)
let controls = new OrbitControls(camera, renderer.domElement)

renderer.setPixelRatio(window.devicePixelRatio)

controls.enableZoom = false
controls.enableKeys = false

let loader = new TextureLoader()

// Light

scene.add(new AmbientLight(0xafafaf))

let light = new DirectionalLight(0x606060, 1)
light.position.set(1, 0, 1)
scene.add(light)

// Scene

scene.background = new Color('white')

let sphere = new Mesh(
  new SphereGeometry(RADIUS, 45, 45),
  new MeshPhongMaterial({
    map: loader.load(mapUrl)
  })
)
scene.add(sphere)

let dot = new Mesh(
  new SphereGeometry(0.012, 12, 12),
  new MeshBasicMaterial({
    color: 0x187cff
  })
)
scene.add(dot)

// Methods

function resize () {
  renderer.setSize(div.clientWidth, div.clientHeight)
  render()
}

function render () {
  controls.update()
  renderer.render(scene, camera)
  requestAnimationFrame(render)
}

function setPosition (position, radius, latitude, longitude) {
  let phi = (90 - latitude) * (Math.PI / 180)
  let theta = (longitude + 180) * (Math.PI / 180)

  position.x = -radius * Math.sin(phi) * Math.cos(theta)
  position.z = radius * Math.sin(phi) * Math.sin(theta)
  position.y = radius * Math.cos(phi)
}

window.sL = l => {
  setPosition(dot.position, RADIUS, l.latitude, l.longitude)
  setPosition(camera.position, 2, l.latitude > 0 ? 20 : -20, l.longitude)

  let now = new Date()
  let solstice = new Date(now.getFullYear() + '-06-21 00:00:00')
  let days = (now - solstice) / (1000 * 60 * 60 * 24)
  let sunLat = 23.44 * Math.cos(2 * Math.PI * days / 365.26)
  let sunLong = 180 - 15 * (now.getUTCHours() + now.getMinutes() / 60)
  setPosition(light.position, 2, sunLat, sunLong)

  window.addEventListener('resize', resize)
  div.appendChild(renderer.domElement)
  resize()
  loading.remove()
}
