$ ->
  after = (ms, fn) -> setTimeout(fn, ms)

  # Вращение после загрузки

  images = $('.images')
  manual = false
  $(window).load ->
    after 1000, ->
      images.addClass('is-real') unless manual

  # Вращение по клику

  halfImage = images.width() / 2
  images.on 'click touchdown', (e) ->
    manual  = true
    rotated = images.hasClass('is-real')
    toRight = e.offsetX > halfImage
    toRight = not toRight if rotated

    images.removeClass('is-animated')
    images.toggleClass('with-left-rotation',  not toRight).
           toggleClass('with-right-rotation', toRight)
    after 1, ->
      images.addClass('is-animated')
      after 1, ->
        images.toggleClass('is-real')
    false
