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
