import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

// scrypt parameters (N=2^15, r=8, p=1) follow OWASP's minimum recommendation.
const KEY_LENGTH = 64
const PARAMS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, PARAMS, (err, key) =>
      err ? reject(err) : resolve(key),
    )
  })
}

// Stored format: scrypt$<salt base64>$<hash base64>
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await derive(password, salt)
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [algo, saltB64, hashB64] = stored.split('$')
  if (algo !== 'scrypt' || !saltB64 || !hashB64) return false
  const expected = Buffer.from(hashB64, 'base64')
  const actual = await derive(password, Buffer.from(saltB64, 'base64'))
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
