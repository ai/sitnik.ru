#!/usr/bin/env ruby1.9
# Constants and common code for generator and uploader.

UPLOAD_TO = 'sitnik@sitnik.ru:/home/sitnik/data/www/sitnik.ru/'


require 'pathname'
ROOT    = Pathname.new(__FILE__).dirname.parent.realpath
PUBLIC  = ROOT.join('public')
CONTENT = ROOT.join('content')

def build
  load Pathname.new(__FILE__).dirname.join('build')
end
