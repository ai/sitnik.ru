import { MeshPhongMaterial } from 'three/src/materials/MeshPhongMaterial.js'
import { MeshBasicMaterial } from 'three/src/materials/MeshBasicMaterial.js'
import { PerspectiveCamera } from 'three/src/cameras/PerspectiveCamera.js'
import { ImageBitmapLoader } from 'three/src/loaders/ImageBitmapLoader.js'
import { DirectionalLight } from 'three/src/lights/DirectionalLight.js'
import { SphereGeometry } from 'three/src/geometries/SphereGeometry.js'
import { SpriteMaterial } from 'three/src/materials/SpriteMaterial.js'
import { WebGLRenderer } from 'three/src/renderers/WebGLRenderer.js'
import { CanvasTexture } from 'three/src/textures/CanvasTexture.js'
import { AmbientLight } from 'three/src/lights/AmbientLight.js'
import { ImageLoader } from 'three/src/loaders/ImageLoader.js'
import { Spherical } from 'three/src/math/Spherical.js'
import { Vector3 } from 'three/src/math/Vector3.js'
import { Sprite } from 'three/src/objects/Sprite.js'
import { Scene } from 'three/src/scenes/Scene.js'
import { Color } from 'three/src/math/Color.js'
import { Mesh } from 'three/src/objects/Mesh.js'

import visited from './dots.js'

const IS_WORKER = typeof window !== 'object'
const RADIUS = 0.765 * 0.88
const PI2 = 2 * Math.PI

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

let loaded = 0

function load() {
  loaded += 1
  if (loaded === 2) {
    renderer.render(scene, camera)
    finishLoading(1)
  }
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
    if (!canvas.style) canvas.style = { width, height }

    renderer = new WebGLRenderer({ canvas, antialias: true })
    renderer.setPixelRatio(pixelRatio)
    renderer.setSize(width, height)
    canvasHeight = height

    // Temporary disable to check Safari
    // if (!isWebP) {
    //   mapUrl = mapUrl.replace('webp', 'png')
    //   hereUrl = hereUrl.replace('webp', 'png')
    // }

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

  resize(width, height) {
    renderer.setSize(width, height)
    canvasHeight = height
    renderer.render(scene, camera)
  },

  move(start, end) {
    delta.setFromVector3(camera.position)

    delta.theta -= (PI2 * (end[0] - start[0])) / canvasHeight
    delta.phi -= (PI2 * (end[1] - start[1])) / canvasHeight

    delta.makeSafe()
    camera.position.setFromSpherical(delta)
    camera.lookAt(0, 0, 0)

    let distanceToHere = camera.position.distanceTo(here.position)
    here.material.depthTest = distanceToHere > distanceToEdge

    renderer.render(scene, camera)
  }
}

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
