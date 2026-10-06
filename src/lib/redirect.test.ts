import { expect, it } from 'vitest'
import { safeRedirectPath } from './redirect'

it('rejects external redirects including browser-normalized backslashes', () => {
  for (const path of [
    undefined,
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/\n/evil.example',
    'javascript:alert(1)',
  ])
    expect(safeRedirectPath(path)).toBe('/')
  expect(safeRedirectPath('/profile')).toBe('/profile')
  expect(safeRedirectPath('/search?q=anime&page=2')).toBe(
    '/search?q=anime&page=2',
  )
})
