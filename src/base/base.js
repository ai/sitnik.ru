let lastDown, lastDownAt

document.addEventListener('mousedown', e => {
  lastDown = e.target
  lastDownAt = Date.now()
})

document.addEventListener('focusin', e => {
  console.log(e.target, lastDown, Date.now() - lastDownAt)
  if (e.target === lastDown && Date.now() - lastDownAt < 999) {
    e.target.blur()
  }
})

let lastTouch

document.addEventListener('touchstart', e => {
  if (e.target.tagName === 'A') {
    lastTouch = e.target
    e.target.classList.add('is-pressed')
  }
})

document.addEventListener('touchend', () => {
  lastTouch.classList.remove('is-pressed')
})
