// Fixed event names, no request bodies, identifiers, URLs, tokens or raw errors.
// Sample repeated events per process to keep abuse from flooding logs.
type Event =
  | 'login_failed'
  | 'account_created'
  | 'password_reset_requested'
  | 'password_changed'
  | 'rate_limited'
const windows = new Map<Event, { at: number; suppressed: number }>()
export function securityEvent(event: Event) {
  const now = Date.now()
  const last = windows.get(event)
  if (last && now - last.at < 60_000) {
    last.suppressed++
    return
  }
  console.info(
    JSON.stringify({
      type: 'security',
      event,
      suppressedSinceLast: last?.suppressed ?? 0,
    }),
  )
  windows.set(event, { at: now, suppressed: 0 })
}
