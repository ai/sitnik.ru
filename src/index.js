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

document.head.innerHTML += '<style>' +
  'a::-moz-focus-inner{border: 0}' +
  '.link{transition:color 200ms}' +
  '.link:focus{color:white}' +
  '.link:focus::before{transform:none;background:rgb(24,124,255)}' +
'</style>'
