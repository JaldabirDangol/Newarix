const dayFmt = new Intl.DateTimeFormat('en', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

export function formatDay(iso: string) {
  return dayFmt.format(new Date(iso))
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatJoined(iso: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso))
}

/** "3 days ago" style, for list rows. */
export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.round((now - new Date(iso).getTime()) / 1000)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (s < 60) return 'just now'
  if (s < 3600) return rtf.format(-Math.floor(s / 60), 'minute')
  if (s < 86400) return rtf.format(-Math.floor(s / 3600), 'hour')
  if (s < 86400 * 30) return rtf.format(-Math.floor(s / 86400), 'day')
  if (s < 86400 * 365) return rtf.format(-Math.floor(s / (86400 * 30)), 'month')
  return rtf.format(-Math.floor(s / (86400 * 365)), 'year')
}
