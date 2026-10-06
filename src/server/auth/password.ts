import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

// OWASP's lower-memory scrypt configuration: N=2^15, r=8, p=3.
// Legacy hashes use p=1 and remain readable until a successful login upgrades them.
const KEY_LENGTH = 64
const PARAMS = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }
let active = 0

async function derive(
  password: string,
  salt: Buffer,
  legacy = false,
): Promise<Buffer> {
  if (active >= 4) throw new Error('Authentication is busy. Try again shortly.')
  active++
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      scrypt(
        password,
        salt,
        KEY_LENGTH,
        { ...PARAMS, p: legacy ? 1 : 3 },
        (err, key) => (err ? reject(err) : resolve(key)),
      )
    })
  } finally {
    active--
  }
}

// Versioned stored format: scrypt$v2$<salt base64>$<hash base64>.
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await derive(password, salt)
  return `scrypt$v2$${salt.toString('base64')}$${key.toString('base64')}`
}

export function needsPasswordRehash(stored: string) {
  return !stored.startsWith('scrypt$v2$')
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split('$')
  const legacy = parts.length === 3
  if (
    parts[0] !== 'scrypt' ||
    (!legacy && (parts.length !== 4 || parts[1] !== 'v2'))
  )
    return false
  const salt = Buffer.from(parts[legacy ? 1 : 2], 'base64')
  const expected = Buffer.from(parts[legacy ? 2 : 3], 'base64')
  if (salt.length !== 16 || expected.length !== KEY_LENGTH) return false
  const actual = await derive(password, salt, legacy)
  return timingSafeEqual(actual, expected)
}

// A syntactically valid dummy hash equalizes missing/passwordless-account work.
// It is never used to store credentials or authenticate any account.
const dummy = `scrypt$v2$${Buffer.alloc(16).toString('base64')}$${Buffer.alloc(KEY_LENGTH).toString('base64')}`
export async function verifyLoginPassword(
  password: string,
  stored: string | null | undefined,
) {
  const valid = await verifyPassword(password, stored ?? dummy)
  return Boolean(stored) && valid
}
