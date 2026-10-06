import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './password'

describe('password hashing', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse battery')
    expect(hash).toMatch(/^scrypt\$/)
    expect(await verifyPassword('correct horse battery', hash)).toBe(true)
    expect(await verifyPassword('wrong', hash)).toBe(false)
  })

  it('salts each hash', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'))
  })

  it('rejects malformed stored hashes', async () => {
    expect(await verifyPassword('x', 'bcrypt$abc')).toBe(false)
    expect(await verifyPassword('x', '')).toBe(false)
  })
})

it('keeps legacy hashes readable and identifies them for upgrade', async () => {
  const { scryptSync } = await import('node:crypto')
  const { needsPasswordRehash, verifyLoginPassword } =
    await import('./password')
  const salt = Buffer.alloc(16, 7)
  const hash = scryptSync('legacy-password', salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  })
  const stored = `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`
  expect(await verifyPassword('legacy-password', stored)).toBe(true)
  expect(needsPasswordRehash(stored)).toBe(true)
  expect(needsPasswordRehash(await hashPassword('legacy-password'))).toBe(false)
  expect(await verifyLoginPassword('any-password', null)).toBe(false)
})
