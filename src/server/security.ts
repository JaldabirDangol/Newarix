// Security headers for every response. Kept in one place so the CSP can be
// reviewed (and tested) without reading middleware plumbing.

export function createNonce() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}

/**
 * Content-Security-Policy for HTML pages.
 * - Scripts: same-origin bundles plus inline scripts carrying this request's
 *   nonce (TanStack Start's hydration data).
 * - Styles: 'unsafe-inline' is needed for React `style` attributes.
 * - Images: any https source, since posters come from MAL's CDN and avatars
 *   are user-supplied URLs.
 */
export function contentSecurityPolicy(nonce: string, https: boolean) {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self'",
    'frame-src https://www.youtube-nocookie.com https://megavid.buzz',
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ]
  if (https) directives.push('upgrade-insecure-requests')
  return directives.join('; ')
}

export function securityHeaders(opts: {
  nonce: string | null
  https: boolean
}): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy':
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
  }
  // The CSP is skipped in development: Vite injects inline scripts for HMR.
  if (opts.nonce)
    headers['Content-Security-Policy'] = contentSecurityPolicy(
      opts.nonce,
      opts.https,
    )
  if (opts.https)
    headers['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains'
  return headers
}

/** Requests that can change state and therefore need a same-origin check. */
export function isUnsafeMethod(method: string) {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())
}
