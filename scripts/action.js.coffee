#= require evil-front/after
#= require evil-front/tappable
#= require evil-front/detect-3d
#= require evil-front/queue

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

  if window.history and history.pushState

    translations = { }
    translation  = (url, callback) ->
      if translations[url]
        callback.apply(this, translations[url])
      else
        $.ajax
          type: 'GET'
          url:   url
          fail: -> location = url
          success: (html) ->
            title   = html.match(/<title>([^<]+)<\/title>/)[1]
            content = $(html).find('.content').html()
            translations[url] = [title, content]
            callback.apply(this, translations[url])

    translations[location.pathname] = [document.title, $('.content').html()]

    $('.lang').click ->
      link = $(@)
      return false if link.hasClass('is-loading') or link.hasClass('is-current')
      link.addClass('is-loading')
      evil.queue (done) ->
        translation link.attr('href'), (title, content) ->
          $('.lang').removeClass('is-current')
          link.addClass('is-current').removeClass('is-loading')

          document.title = title
          old  = $('.content')
          next = $('<div class="content is-next is-hidden" />').html(content).
                   insertAfter(old)

          after 1, ->
            old.addClass('is-hidden')
            next.removeClass('is-hidden')
          after 601, ->
            next.removeClass('is-next')
            old.remove()
            done()

          history.pushState({ }, '', link.attr('href'))
      false
