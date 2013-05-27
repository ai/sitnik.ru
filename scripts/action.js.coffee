#= require evil-front/after
#= require evil-front/tappable
#= require evil-front/detect-3d

$ ->

  # Вращение фотографии и маски

  angle  = -180
  images = $('.images')
  photo  = $('.photo')
  mask   = $('.mask')
  rotate = if evil.body.hasClass('transform-3d')
    (direction) ->
      angle += if direction == 'left' then -180 else 180
      photo.css(transform: "rotateY(#{ angle }deg)")
      mask.css(transform: "rotateY(#{ angle + 180 }deg)")
  else
    -> images.toggleClass('is-real')

  # Вращение после загрузки

  manual = false
  $(window).load ->
    after 3000, ->
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

  # Смена языка

  waiters = []
  waiting = false
  call    = (callback) ->
    waiting = true
    callback ->
      waiting = false
      waiter  = waiters.pop()
      call(waiter) if waiter

  locked  = (callback) ->
    if waiting
      waiters.push(callback)
    else
      call(callback)

  if window.history and history.pushState
    $('.lang').click ->
      link = $(@)
      return false if link.hasClass('is-loading') or link.hasClass('is-current')
      link.addClass('is-loading')
      locked (done) =>
        ajax = $.get(link.attr('href'))
        ajax.fail -> location = link.attr('url')
        ajax.success (html) ->
          $('.lang').removeClass('is-current')
          link.addClass('is-current').removeClass('is-loading')

          document.title = html.match(/<title>([^<]+)<\/title>/)[1]
          old  = $('.content')
          next = $(html).find('.content').
                   addClass('is-next is-hidden').insertAfter(old)
          after 1, ->
            old.addClass('is-hidden')
            next.removeClass('is-hidden')
          after 601, ->
            next.removeClass('is-next')
            old.remove()
            done()

          history.pushState({ }, '', link.attr('href'))
      false
