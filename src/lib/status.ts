import type { MediaKind } from './media'

export const listStatuses = [
  'current',
  'completed',
  'planned',
  'on_hold',
  'dropped',
] as const
export type ListStatus = (typeof listStatuses)[number]

export function statusLabel(status: ListStatus, kind: MediaKind) {
  switch (status) {
    case 'current':
      return kind === 'anime' ? 'Watching' : 'Reading'
    case 'completed':
      return 'Completed'
    case 'planned':
      return kind === 'anime' ? 'Plan to watch' : 'Plan to read'
    case 'on_hold':
      return 'On hold'
    case 'dropped':
      return 'Dropped'
  }
}

/** CSS custom property holding each status colour. */
export const statusColor: Record<ListStatus, string> = {
  current: 'var(--st-current)',
  completed: 'var(--st-completed)',
  planned: 'var(--st-planned)',
  on_hold: 'var(--st-hold)',
  dropped: 'var(--st-dropped)',
}

export const unitLabel = (kind: MediaKind, plural = true) =>
  kind === 'anime'
    ? plural
      ? 'episodes'
      : 'episode'
    : plural
      ? 'chapters'
      : 'chapter'
