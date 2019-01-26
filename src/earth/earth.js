let { MeshPhongMaterial } = require('three/src/materials/MeshPhongMaterial')
let { PerspectiveCamera } = require('three/src/cameras/PerspectiveCamera')
let { DirectionalLight } = require('three/src/lights/DirectionalLight')
let { SphereGeometry } = require('three/src/geometries/SphereGeometry')
let { WebGLRenderer } = require('three/src/renderers/WebGLRenderer')
let { AmbientLight } = require('three/src/lights/AmbientLight')
let OrbitControls = require('three-orbitcontrols')
let { Scene } = require('three/src/scenes/Scene')
let { Color } = require('three/src/math/Color')
let { Mesh } = require('three/src/objects/Mesh')

// DOM

let loader = document.querySelector('.globe_loading')
let div = document.querySelector('.globe_earth')

// WebGL

let renderer = new WebGLRenderer()
let scene = new Scene()
let camera = new PerspectiveCamera(45, 1, 0.01, 1000)
let controls = new OrbitControls(camera, renderer.domElement)

renderer.setPixelRatio(window.devicePixelRatio)

controls.enableZoom = false
controls.enableKeys = false

// Light

scene.add(new AmbientLight(0x989898))

let light = new DirectionalLight(0x606060, 1)
light.position.set(1, 0, 1)
scene.add(light)

// Scene

scene.background = new Color('white')
camera.position.z = 1.5

let sphere = new Mesh(
  new SphereGeometry(0.575, 32, 32),
  new MeshPhongMaterial({
  })
)
scene.add(sphere)

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

window.sL = location => {
  console.log(location)
}

// Start

window.addEventListener('resize', resize)

div.appendChild(renderer.domElement)
resize()
loader.remove()
