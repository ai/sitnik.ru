import { readFile } from 'node:fs/promises'

export async function read(file) {
  let buffer = await readFile(file)
  return buffer.toString()
}
