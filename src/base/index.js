let lastDown, lastDownAt

document.addEventListener('mousedown', e => {
  lastDown = e.target
  lastDownAt = Date.now()
})

document.addEventListener('focusin', e => {
  if (e.target === lastDown && Date.now() - lastDownAt < 1000) {
    e.target.blur()
  }
})
