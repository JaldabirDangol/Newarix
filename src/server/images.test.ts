import { describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import { avatarImage, posterUrl, resizedPoster } from './images'

describe('image handling', () => {
  it('allows AniList cover images and nothing else on that host', () => {
    expect(posterUrl('https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587.jpg').hostname).toBe('s4.anilist.co')
    for (const url of ['https://s4.anilist.co/other/x.jpg', 'http://s4.anilist.co/file/anilistcdn/x.jpg', 'https://s4.anilist.co.evil.example/file/anilistcdn/x.jpg']) expect(() => posterUrl(url)).toThrow()
  })

  it('restricts the proxy to HTTPS poster paths on the exact MAL CDN host', () => {
    expect(posterUrl('https://cdn.myanimelist.net/images/anime/1.jpg').hostname).toBe('cdn.myanimelist.net')
    for (const url of ['http://cdn.myanimelist.net/images/1.jpg', 'https://localhost/images/1.jpg', 'https://cdn.myanimelist.net.evil.example/images/1.jpg', 'https://user:pass@cdn.myanimelist.net/images/1.jpg', 'https://cdn.myanimelist.net:4433/images/1.jpg', 'https://cdn.myanimelist.net/../secret']) expect(() => posterUrl(url)).toThrow()
  })

  it('rejects unsupported or oversized avatar files', async () => {
    await expect(avatarImage(new File(['<svg/>'], 'avatar.svg', { type: 'image/svg+xml' }))).rejects.toThrow('JPEG, PNG or WebP')
    await expect(avatarImage(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'avatar.png', { type: 'image/png' }))).rejects.toThrow('5 MB')
    await expect(avatarImage(new File(['<svg/>'], 'fake.png', { type: 'image/png' }))).rejects.toThrow()
  })

  it('normalizes uploads into a square WebP without the original metadata', async () => {
    const input = await sharp({ create: { width: 600, height: 300, channels: 3, background: '#ffd84d' } }).withMetadata().png().toBuffer()
    const output = Buffer.from(await avatarImage(new File([new Uint8Array(input)], 'avatar.png', { type: 'image/png' })), 'base64')
    const meta = await sharp(output).metadata()
    expect(meta).toMatchObject({ width: 256, height: 256, format: 'webp' })
    expect(meta.exif).toBeUndefined()
  })

  it('resizes, shares in-flight work and caches posters', async () => {
    const input = await sharp({ create: { width: 400, height: 600, channels: 3, background: '#ffd84d' } }).png().toBuffer()
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array(input)))
    vi.stubGlobal('fetch', fetchMock)
    try {
      const url = posterUrl('https://cdn.myanimelist.net/images/anime/test-cache.png')
      const [one, two] = await Promise.all([resizedPoster(url, 128), resizedPoster(url, 128)])
      expect(one.equals(two)).toBe(true)
      expect(await sharp(one).metadata()).toMatchObject({ width: 128, height: 192, format: 'webp' })
      await resizedPoster(url, 128)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: 'error' })
    } finally { vi.unstubAllGlobals() }
  })
})
