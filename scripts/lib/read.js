import { readFile } from 'fs/promises'

export async function read(file) {
  let buffer = await readFile(file)
  return buffer.toString()
}
