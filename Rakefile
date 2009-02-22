require 'rake'
require 'pathname'

ROOT    = Pathname.new(__FILE__).dirname.realpath
PUBLIC  = ROOT.join('public')
CONTENT = ROOT.join('content')

desc 'Remove generated files'
task :clobber do
  PUBLIC.rmtree if PUBLIC.exist?
end
