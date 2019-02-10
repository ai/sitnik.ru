let { MeshPhongMaterial } = require('three/src/materials/MeshPhongMaterial')
let { MeshBasicMaterial } = require('three/src/materials/MeshBasicMaterial')
let { PerspectiveCamera } = require('three/src/cameras/PerspectiveCamera')
let { DirectionalLight } = require('three/src/lights/DirectionalLight')
let { SphereGeometry } = require('three/src/geometries/SphereGeometry')
let { SpriteMaterial } = require('three/src/materials/SpriteMaterial')
let { WebGLRenderer } = require('three/src/renderers/WebGLRenderer')
let { TextureLoader } = require('three/src/loaders/TextureLoader')
let { AmbientLight } = require('three/src/lights/AmbientLight')
let { Spherical } = require('three/src/math/Spherical')
let { Vector3 } = require('three/src/math/Vector3')
let { Vector2 } = require('three/src/math/Vector2')
let { Sprite } = require('three/src/objects/Sprite')
let { Scene } = require('three/src/scenes/Scene')
let { Color } = require('three/src/math/Color')
let { Mesh } = require('three/src/objects/Mesh')

let visited = require('../../cities/dots.js')

const RADIUS = 0.765 * 0.88

// DOM

let loading = document.querySelector('.globe_loading')
let div = document.querySelector('.globe_earth')

let mapUrl, hereUrl
for (let i of document.querySelectorAll('[as=image]')) {
  if (i.href.indexOf('/map.') !== -1) {
    mapUrl = i.href
  } else if (i.href.indexOf('/here.') !== -1) {
    hereUrl = i.href
  }
}

// Base

let renderer = new WebGLRenderer()
let scene = new Scene()
let camera = new PerspectiveCamera(45, 1, 0.01, 1000)

renderer.setPixelRatio(window.devicePixelRatio)

let loader = new TextureLoader()

// Light

scene.add(new AmbientLight(0x909090))

let light = new DirectionalLight(0x4f4f4f, 1)
light.position.set(1, 0, 1)
scene.add(light)

// Methods

function resize () {
  renderer.setSize(div.clientWidth, div.clientHeight)
  renderer.render(scene, camera)
}

function render () {
  renderer.render(scene, camera)
}

function setPosition (position, radius, latitude, longitude) {
  let phi = (90 - latitude) * (Math.PI / 180)
  let theta = (longitude + 180) * (Math.PI / 180)

  position.x = -radius * Math.sin(phi) * Math.cos(theta)
  position.z = radius * Math.sin(phi) * Math.sin(theta)
  position.y = radius * Math.cos(phi)
}

function moveSun () {
  let now = new Date()
  let solstice = new Date(now.getFullYear() + '-06-21 00:00:00')
  let days = (now - solstice) / (1000 * 60 * 60 * 24)
  let sunLat = 23.44 * Math.cos(2 * Math.PI * days / 365.26)
  let sunLong = 180 - 15 * (now.getUTCHours() + now.getMinutes() / 60)
  setPosition(light.position, 2, sunLat, sunLong)
}

let loaded = 0

function load () {
  loaded += 1
  if (loaded === 3) {
    div.appendChild(renderer.domElement)
    loading.remove()
    render()
  }
}

// Scene

scene.background = new Color(0xffffff)

let sphere = new Mesh(
  new SphereGeometry(RADIUS, 64, 64),
  new MeshPhongMaterial({
    map: loader.load(mapUrl, load)
  })
)
scene.add(sphere)

let here = new Sprite(
  new SpriteMaterial({
    map: loader.load(hereUrl, load)
  })
)
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

// Control

let rotateStart = new Vector2()
let rotateEnd = new Vector2()
let rotateDelta = new Vector2()
let delta = new Spherical()

const PI2 = 2 * Math.PI

let distanceToEdge

function move () {
  delta.setFromVector3(camera.position)

  rotateDelta.subVectors(rotateEnd, rotateStart)
  delta.theta -= PI2 * rotateDelta.x / renderer.domElement.clientHeight
  delta.phi -= PI2 * rotateDelta.y / renderer.domElement.clientHeight
  rotateStart.copy(rotateEnd)

  delta.makeSafe()
  camera.position.setFromSpherical(delta)
  camera.lookAt(0, 0, 0)

  let distanceToHere = camera.position.distanceTo(here.position)
  here.material.depthTest = distanceToHere > distanceToEdge

  requestAnimationFrame(render)
}

function mouseMove (e) {
  rotateEnd.set(e.clientX, e.clientY)
  move()
}

function mouseUp () {
  document.removeEventListener('mousemove', mouseMove, false)
  document.removeEventListener('mouseup', mouseUp, false)
}

renderer.domElement.addEventListener('mousedown', e => {
  if (e.button === 0) { // left
    rotateStart.set(e.clientX, e.clientY)
    e.preventDefault()
    document.addEventListener('mousemove', mouseMove, false)
    document.addEventListener('mouseup', mouseUp, false)
  }
})

if (window.innerWidth > 980) {
  renderer.domElement.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
      rotateStart.set(e.touches[0].pageX, e.touches[0].pageY)
    }
  }, { passive: true })
  renderer.domElement.addEventListener('touchmove', e => {
    if (e.touches.length === 1) {
      rotateEnd.set(e.touches[0].pageX, e.touches[0].pageY)
      move()
    }
  }, { passive: true })
} else {
  renderer.domElement.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
      e.preventDefault()
      rotateStart.set(e.touches[0].pageX, e.touches[0].pageY)
    }
  })
  renderer.domElement.addEventListener('touchmove', e => {
    if (e.touches.length === 1) {
      e.preventDefault()
      rotateEnd.set(e.touches[0].pageX, e.touches[0].pageY)
      move()
    }
  })
}

// Init

window.addEventListener('resize', resize)
resize()

moveSun()
setTimeout(moveSun, 30 * 60 * 1000)

window.sL = l => {
  setPosition(here.position, RADIUS, l.latitude, l.longitude)
  setPosition(camera.position, 2, l.latitude > 0 ? 20 : -20, l.longitude)
  camera.lookAt(0, 0, 0)
  distanceToEdge = camera.position.distanceTo(new Vector3(0, RADIUS, 0))
  load()
}
