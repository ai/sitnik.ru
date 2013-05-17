$ ->
  after = (ms, fn) -> setTimeout(fn, ms)

  # Вращение фотографии и маски

  angle  = -180
  photo  = $('.photo')
  mask   = $('.mask')
  rotate = (direction) ->
    angle += if direction == 'left' then -180 else 180
    photo.css(transform: "rotateY(#{ angle }deg)")
    mask.css(transform: "rotateY(#{ angle + 180 }deg)")

  # Вращение после загрузки

  images = $('.images')
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
