#!/usr/bin/env node
import { scrypt, randomBytes } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 }
const KEY_LENGTH = 64

function readPasswordSilently(prompt) {
  return new Promise((resolve, reject) => {
    process.stdout.write(prompt)
    const stdin = process.stdin
    const isTTY = stdin.isTTY
    if (isTTY) stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')

    let buffer = ''
    const onData = (chunk) => {
      for (const char of chunk) {
        const code = char.charCodeAt(0)
        if (code === 3) {
          if (isTTY) stdin.setRawMode(false)
          stdin.pause()
          stdin.removeListener('data', onData)
          process.exit(130)
        }
        if (char === '\n' || char === '\r') {
          if (isTTY) stdin.setRawMode(false)
          stdin.pause()
          stdin.removeListener('data', onData)
          process.stdout.write('\n')
          resolve(buffer)
          return
        }
        if (code === 127 || code === 8) {
          buffer = buffer.slice(0, -1)
          continue
        }
        buffer += char
      }
    }
    stdin.on('data', onData)
    stdin.on('error', reject)
  })
}

const password = await readPasswordSilently('New password: ')
if (!password || password.length < 12) {
  console.error('Password must be at least 12 characters.')
  process.exit(1)
}
const confirm = await readPasswordSilently('Confirm:      ')
if (confirm !== password) {
  console.error('Passwords do not match.')
  process.exit(1)
}

const salt = randomBytes(16)
const derived = await scryptAsync(password, salt, KEY_LENGTH, SCRYPT_PARAMS)
const hash = `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt.toString('base64')}$${derived.toString('base64')}`

console.log('\nAdd this line to your .env file (remove any BKOS_PASSWORD entry):')
console.log('')
console.log(`BKOS_PASSWORD_HASH=${hash}`)
console.log('')
