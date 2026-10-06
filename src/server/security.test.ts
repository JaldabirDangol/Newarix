import { describe, expect, it } from 'vitest'
import {
  contentSecurityPolicy,
  createNonce,
  isUnsafeMethod,
  securityHeaders,
} from './security'

describe('security headers', () => {
  it('always sets the baseline headers', () => {
    const h = securityHeaders({ nonce: null, https: false })
    expect(h['X-Frame-Options']).toBe('DENY')
    expect(h['X-Content-Type-Options']).toBe('nosniff')
    expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    expect(h['Content-Security-Policy']).toBeUndefined()
    expect(h['Strict-Transport-Security']).toBeUndefined()
  })

  it('adds CSP with the nonce, and HSTS on https', () => {
    const h = securityHeaders({ nonce: 'abc', https: true })
    expect(h['Content-Security-Policy']).toContain(
      "script-src 'self' 'nonce-abc'",
    )
    expect(h['Content-Security-Policy']).toContain('upgrade-insecure-requests')
    expect(h['Strict-Transport-Security']).toMatch(/max-age=\d+/)
  })

  it('never allows unsafe-inline or unsafe-eval scripts', () => {
    const csp = contentSecurityPolicy('n', false)
    const script = csp.split('; ').find((d) => d.startsWith('script-src'))
    expect(script).not.toMatch(/unsafe-(inline|eval)/)
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp.split('; ').find((d) => d.startsWith('frame-src'))).toBe(
      'frame-src https://www.youtube-nocookie.com https://megavid.buzz',
    )
  })

  it('creates a different nonce each time', () => {
    expect(createNonce()).not.toBe(createNonce())
    expect(createNonce()).toMatch(/^[A-Za-z0-9+/]{22}==$/)
  })

  it('treats only state-changing methods as unsafe', () => {
    expect(isUnsafeMethod('POST')).toBe(true)
    expect(isUnsafeMethod('delete')).toBe(true)
    expect(isUnsafeMethod('GET')).toBe(false)
    expect(isUnsafeMethod('HEAD')).toBe(false)
  })
})
