$ ->
  after = (ms, fn) -> setTimeout(fn, ms)
  $body = $('body')

  # Определяем наличие 3D

  detect3d = ->
    support = $body.css('perspective')?
    if support and document.body.style.webkitPerspective?
      support = matchMedia("(transform-3d), (-webkit-transform-3d)").matches
    support
  support3d = detect3d()

  $body.addClass(if support3d then 'transform-3d' else 'transform-2d')

  # Вращение фотографии и маски

  angle  = -180
  images = $('.images')
  photo  = $('.photo')
  mask   = $('.mask')
  rotate = if support3d
    (direction) ->
      angle += if direction == 'left' then -180 else 180
      photo.css(transform: "rotateY(#{ angle }deg)")
      mask.css(transform: "rotateY(#{ angle + 180 }deg)")
  else
    -> images.toggleClass('is-real')

  # Вращение после загрузки

  manual = false
  $(window).load ->
    after 1000, ->
      rotate('right') unless manual

  # Вращение по клику

  halfImage = images.width() / 2
  images.on 'click touchdown', (e) ->
    manual = true
    inRightPart = e.offsetX > halfImage

    if inRightPart
      rotate('right')
    else
      rotate('left')
    false
