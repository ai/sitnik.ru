$ ->
  after = (ms, fn) -> setTimeout(fn, ms)

  images = $('.images')

  $(window).load ->
    after 1000, -> images.addClass('is-real')
