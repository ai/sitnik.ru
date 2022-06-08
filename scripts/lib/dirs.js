import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPTS = join(ROOT, 'scripts')

export const SRC = join(ROOT, 'src')
export const DIST = join(ROOT, 'dist')
export const NGINX = join(ROOT, 'nginx.conf')
export const DOTS = join(SRC, 'earth', 'dots.js')
export const CITIES = join(SCRIPTS, 'cities', 'cities.json')
export const PLACES = join(SCRIPTS, 'cities', 'places.json')
export const LOCATION = join(SCRIPTS, 'location', 'last.json')
