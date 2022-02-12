import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

export const SRC = join(ROOT, 'src')
export const DIST = join(ROOT, 'dist')
export const NGINX = join(ROOT, 'nginx.conf')
export const CITIES = join(ROOT, 'scripts', 'cities', 'cities.json')
export const LOCATION = join(ROOT, 'scripts', 'location', 'last.json')
