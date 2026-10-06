// Poster hosts the /api/img resizer may fetch from. Anything else (user
// avatars, data: URIs) is used as-is.
const ALLOWED: { host: string; path: string }[] = [
  { host: 's4.anilist.co', path: '/file/anilistcdn/' },
  { host: 'cdn.myanimelist.net', path: '/images/' },
]

export function isAllowedPoster(url: URL) {
  return (
    url.protocol === 'https:' &&
    !url.port &&
    !url.username &&
    !url.password &&
    ALLOWED.some((a) => url.hostname === a.host && url.pathname.startsWith(a.path))
  )
}

/** Routes allowlisted posters through our resizing endpoint. */
export function imageUrl(url: string, width = 320): string {
  try {
    if (isAllowedPoster(new URL(url))) {
      return `/api/img?${new URLSearchParams({ url, w: String(width) })}`
    }
  } catch {
    /* Local avatar URLs are already resized. */
  }
  return url
}
