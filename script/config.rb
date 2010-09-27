# Constants and common code for generator and uploader.

UPLOAD_TO = 'ai@188.120.225.1:/home/ai/sitnik.ru'

require 'pathname'
require 'yaml'
require 'rubygems'

gem 'haml'
require 'haml'
require 'sass'

ROOT    = Pathname.new(__FILE__).dirname.parent.realpath
PUBLIC  = ROOT.join('public')
CONTENT = ROOT.join('content')

def build(options)
  `#{Pathname.new(__FILE__).dirname.join('build')} #{options}`
end

def t
  @i18n
end

class Translation
  def initialize(hash)
    @data = hash
  end
  def method_missing(name, *params)
    value = @data[name.to_s]
    if value.is_a? Hash
      Translation.new(value) 
    else
      params.each_with_index { |p, i| value = value.gsub("%#{i+1}", p.to_s) }
      value
    end
  end
end
