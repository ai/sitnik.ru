require 'ostruct'
require 'pathname'

class Pathname
  def glob(pattern, &block)
    Pathname.glob(self.join(pattern), &block)
  end
end

ROOT    = Pathname(__FILE__).dirname
CONTENT = ROOT.join('content/')
PUBLIC  = ROOT.join('public/')
LAYOUT  = ROOT.join('layout/')

require 'slim'
require 'uglifier'
require 'sprockets'
require 'coffee_script'
require 'rails-sass-images'
require 'autoprefixer-rails'
require 'gravatar_image_tag'

require 'r18n-core'
R18n.default_places = ROOT.join('i18n')

class Sprockets::Context
  include R18n::Helpers
end

class Helpers
  include R18n::Helpers

  attr_accessor :env

  def self.instance(env)
    @@instance ||= self.new
    @@instance.env = env
    @@instance.clear!
    @@instance
  end

  def clear!
    @data = nil
  end

  def assets
    @sprockets ||= begin
      Sprockets::Environment.new(ROOT) do |env|
        env.append_path(LAYOUT)

        if @env == :production
          env.js_compressor  = Uglifier.new(copyright: false)
          env.css_compressor = :sass
        end

        AutoprefixerRails.install(env)
        RailsSassImages.install(env)
      end
    end
  end

  def render(file, &block)
    options = { format: :html5, disable_escape: true }
    Slim::Template.new(file.to_s, options).render(self, &block)
  end

  def production?
    @env == :production
  end

  def each_locale(&block)
    r18n.available_locales.sort { |a, b| b.code <=> a.code }.each do |locale|
      yield(locale.code, locale)
    end
  end

  def js_from_cdn(lib, version)
    url  = "//ajax.googleapis.com/ajax/libs/"
    url += "#{lib}/#{version}/#{lib}#{production? ? '.min' : ''}.js"
    "<script src=#{url}></script>"
  end

  def include_statistics
    LAYOUT.join('statistics.html').read
  end

  def disable_mobile_zoom
    '<meta name="viewport" content="width=device-width, initial-scale=1.0, ' +
      'maximum-scale=1.0, user-scalable=0" />'
  end

  def gravatar_url(email, opts = { })
    GravatarImageTag::gravatar_url(email, opts)
  end

  def hash_to_struct(obj)
    return obj.map { |i| hash_to_struct(i) } if obj.is_a? Array
    return obj unless obj.is_a? Hash

    obj.each_pair { |key, value| obj[key] = hash_to_struct(value) }
    OpenStruct.new(obj)
  end

  def data
    @data ||= begin
      hash_to_struct YAML.load_file(ROOT.join('data.yml'))
    end
  end

  def translated?(str)
    str.translated? and str.locale == r18n.locale
  end
end

def move_with_extra_js(from, to, js)
  to.open('w') do |io|
    io << from.read.gsub(/<\/title>/, "<\/title><script>#{js}</script>")
  end
  from.delete
end

def build_index(production = false)
  index  = LAYOUT.join('index.html.slim')
  helper = Helpers.instance(production ? :production : :development)
  locale = R18n.get.locale.code.downcase

  PUBLIC.mkpath

  file = PUBLIC.join("#{locale}.html")
  file.open('w') { |io| io << helper.render(index) }

  if locale == 'ru'
    redirect = helper.assets['language-redirect.js']
    move_with_extra_js(file, PUBLIC.join("index.html"), redirect)
  end
end

desc 'Build site files'
task :build do
  PUBLIC.mkpath
  PUBLIC.glob('*') { |i| i.rmtree }

  print 'build'

  R18n.available_locales.each do |locale|
    R18n.set(locale.code)
    build_index(true)
    print '.'
  end

  %w( favicon.ico apple-touch-icon.png ).each do |file|
    FileUtils.cp LAYOUT.join(file), PUBLIC.join(file)
  end

  print "\n"
end

desc 'Run server for development'
task :server do
  require 'sinatra/base'

  class SitnikRu < Sinatra::Base
    set :public_folder, nil
    set :bind, '0.0.0.0'
    set :port, 3000

    get /^(\/|\/index\.html)$/ do
      build_page('ru')
      send_file PUBLIC.join('index.html')
    end

    get '/en' do
      build_page('en')
      send_file PUBLIC.join('en.html')
    end

    get '/favicon.ico' do
      send_file LAYOUT.join('favicon.ico')
    end

    get '/apple-touch-icon.png' do
      send_file LAYOUT.join('apple-touch-icon.png')
    end

    def build_page(locale_code)
      R18n.clear_cache!
      R18n.set(locale_code).reload!
      build_index
    end
  end

  SitnikRu.run!
end

desc 'Prepare commit to GitHub Pages'
task :deploy => :build do
  sh ['git checkout gh-pages',
      'git rm *.ico',
      'git rm *.png',
      'git rm *.html',
      'cp public/* ./',
      'git add *.html',
      'git add *.png',
      'git add *.ico'].join(' && ')
end
