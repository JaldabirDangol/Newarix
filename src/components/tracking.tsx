import { useState } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { Check, Heart, Loader2, Minus, Plus, Trash2 } from 'lucide-react'
import {
  deleteEntry,
  saveEntry,
  toggleFavorite,
} from '#/lib/tracking.functions'
import { listStatuses, statusColor, statusLabel, unitLabel } from '#/lib/status'
import { EpisodeRibbon, detailLink } from './media'
import { Img, btn, field } from './ui'
import type { EntryDTO } from '#/lib/tracking.functions'
import type { MediaKind } from '#/lib/media'
import type { ListStatus } from '#/lib/status'

type SaveInput = Parameters<typeof saveEntry>[0]['data']

/** Wraps saveEntry with pending/error state for one entry. */
function useEntry(kind: MediaKind, id: number, initial: EntryDTO | null) {
  const [entry, setEntry] = useState(initial)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (patch: Omit<SaveInput, 'kind' | 'id'>) => {
    setPending(true)
    setError(null)
    try {
      setEntry(await saveEntry({ data: { kind, id, ...patch } }))
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save. Try again.',
      )
    } finally {
      setPending(false)
    }
  }
  return { entry, setEntry, save, pending, error, setError }
}

export function StatusPill({
  status,
  kind,
}: {
  status: ListStatus
  kind: MediaKind
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted">
      <span
        className="size-2 rounded-full"
        style={{ background: statusColor[status] }}
        aria-hidden
      />
      {statusLabel(status, kind)}
    </span>
  )
}

function Counter({
  label,
  value,
  total,
  disabled,
  onChange,
}: {
  label: string
  value: number
  total: number | null
  disabled: boolean
  onChange: (next: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft === null) return
    const n = Number.parseInt(draft, 10)
    setDraft(null)
    if (Number.isFinite(n) && n !== value)
      onChange(Math.max(0, total ? Math.min(n, total) : n))
  }
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={btn.icon}
        disabled={disabled || value <= 0}
        onClick={() => onChange(value - 1)}
        aria-label={`Remove one ${label}`}
      >
        <Minus className="size-4" />
      </button>
      <div className="flex items-baseline gap-1 font-mono">
        <input
          aria-label={`${label} progress`}
          inputMode="numeric"
          className="w-14 rounded-md border border-transparent bg-transparent px-1 py-1 text-center text-lg font-semibold hover:border-line focus:border-accent focus:outline-none"
          value={draft ?? String(value)}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          disabled={disabled}
        />
        <span className="text-sm text-muted">/ {total ?? '?'}</span>
      </div>
      <button
        type="button"
        className={`${btn.icon} border-accent/60`}
        disabled={disabled || (total !== null && value >= total)}
        onClick={() => onChange(value + 1)}
        aria-label={`Add one ${label}`}
      >
        <Plus className="size-4" />
      </button>
    </div>
  )
}

/** List controls on a detail page. */
export function TrackerPanel({
  kind,
  id,
  total,
  totalVolumes,
  loggedIn,
  initialEntry,
  initialFavorite,
}: {
  kind: MediaKind
  id: number
  total: number | null
  totalVolumes?: number | null
  loggedIn: boolean
  initialEntry: EntryDTO | null
  initialFavorite: boolean
}) {
  const router = useRouter()
  const { entry, setEntry, save, pending, error, setError } = useEntry(
    kind,
    id,
    initialEntry,
  )
  const [favorite, setFavorite] = useState(initialFavorite)
  const [favPending, setFavPending] = useState(false)
  const [notes, setNotes] = useState(initialEntry?.notes ?? '')
  const [savedNotes, setSavedNotes] = useState(false)

  if (!loggedIn) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-5">
        <p className="font-bold">Track your progress</p>
        <p className="mt-1 text-sm text-muted">
          Log in to add this to your list, count {unitLabel(kind)} and rate it.
        </p>
        <div className="mt-4 flex gap-2">
          <Link
            to="/login"
            search={{ redirect: router.state.location.href }}
            className={`${btn.primary} flex-1`}
          >
            Log in
          </Link>
          <Link to="/signup" className={`${btn.ghost} flex-1`}>
            Sign up
          </Link>
        </div>
      </div>
    )
  }

  const flipFavorite = async () => {
    setFavPending(true)
    try {
      setFavorite((await toggleFavorite({ data: { kind, id } })).favorite)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not update favorites.',
      )
    } finally {
      setFavPending(false)
    }
  }

  const remove = async () => {
    if (
      !window.confirm(
        'Remove this from your list? Your progress, score and notes will be deleted.',
      )
    )
      return
    setError(null)
    try {
      await deleteEntry({ data: { kind, id } })
      setEntry(null)
      setNotes('')
    } catch {
      setError('Could not remove it. Try again.')
    }
  }

  const effectiveTotal = entry?.total ?? total
  const favButton = (
    <button
      type="button"
      onClick={flipFavorite}
      disabled={favPending}
      aria-pressed={favorite}
      className={`${btn.icon} size-11 ${favorite ? 'border-danger text-danger' : ''}`}
      aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Heart className={`size-5 ${favorite ? 'fill-current' : ''}`} />
    </button>
  )

  if (!entry) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex gap-2">
          <button
            type="button"
            className={`${btn.primary} flex-1 py-3`}
            disabled={pending}
            onClick={() => save({ status: 'planned' })}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="size-4" aria-hidden />
            )}
            Add to list
          </button>
          {favButton}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={`${btn.ghost} flex-1 py-2 text-xs`}
            disabled={pending}
            onClick={() => save({ status: 'current' })}
          >
            Start {kind === 'anime' ? 'watching' : 'reading'}
          </button>
          <button
            type="button"
            className={`${btn.ghost} flex-1 py-2 text-xs`}
            disabled={pending}
            onClick={() => save({ status: 'completed' })}
          >
            Mark completed
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    )
  }

  const unit = kind === 'anime' ? 'Episode' : 'Chapter'
  return (
    <div
      className="rounded-2xl border border-line bg-surface p-5"
      aria-busy={pending}
    >
      <div className="flex gap-2">
        <label className="flex-1">
          <span className="sr-only">Status</span>
          <select
            value={entry.status}
            disabled={pending}
            onChange={(e) => save({ status: e.target.value as ListStatus })}
            className={`${field} h-11 border-l-4 font-semibold`}
            style={{ borderLeftColor: statusColor[entry.status] }}
          >
            {listStatuses.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s, kind)}
              </option>
            ))}
          </select>
        </label>
        {favButton}
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wide text-muted uppercase">
            {unit}s
          </span>
          {pending && (
            <Loader2
              className="size-3.5 animate-spin text-muted"
              aria-label="Saving"
            />
          )}
        </div>
        <Counter
          label={unit.toLowerCase()}
          value={entry.progress}
          total={effectiveTotal}
          disabled={pending}
          onChange={(n) => save({ progress: n })}
        />
        <div className="mt-3">
          <EpisodeRibbon
            progress={entry.progress}
            total={effectiveTotal}
            kind={kind}
            color={statusColor[entry.status]}
          />
        </div>
      </div>

      {kind === 'manga' && (
        <div className="mt-5">
          <span className="mb-2 block text-xs font-semibold tracking-wide text-muted uppercase">
            Volumes
          </span>
          <Counter
            label="volume"
            value={entry.progressVolumes}
            total={entry.totalVolumes ?? totalVolumes ?? null}
            disabled={pending}
            onChange={(n) => save({ progressVolumes: n })}
          />
        </div>
      )}

      <fieldset className="mt-5">
        <legend className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
          Your score
        </legend>
        <div className="grid grid-cols-10 gap-1">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
            const on = entry.score !== null && n <= entry.score
            return (
              <button
                key={n}
                type="button"
                disabled={pending}
                aria-pressed={entry.score === n}
                aria-label={`Score ${n} out of 10`}
                onClick={() => save({ score: entry.score === n ? null : n })}
                className={`h-8 rounded-md font-mono text-xs font-semibold transition ${on ? 'bg-accent text-on-accent' : 'bg-raised text-muted hover:text-text'}`}
              >
                {n}
              </button>
            )
          })}
        </div>
        {entry.score !== null && (
          <p className="mt-1.5 text-xs text-muted">
            Select {entry.score} again to clear your score.
          </p>
        )}
      </fieldset>

      <div className="mt-5">
        <label
          htmlFor="entry-notes"
          className="mb-2 block text-xs font-semibold tracking-wide text-muted uppercase"
        >
          Notes
        </label>
        <textarea
          id="entry-notes"
          rows={3}
          maxLength={2000}
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value)
            setSavedNotes(false)
          }}
          placeholder="Only you can see these"
          className={`${field} resize-y`}
        />
        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            className={`${btn.ghost} py-1.5 text-xs`}
            disabled={pending || notes === (entry.notes ?? '')}
            onClick={async () => {
              await save({ notes })
              setSavedNotes(true)
            }}
          >
            Save notes
          </button>
          {savedNotes && (
            <span className="flex items-center gap-1 text-xs text-muted">
              <Check className="size-3.5" aria-hidden /> Saved
            </span>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={remove}
        className="mt-5 flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-danger"
      >
        <Trash2 className="size-3.5" aria-hidden /> Remove from list
      </button>
    </div>
  )
}

/** Card for the "Continue watching" row, with a one-tap +1. */
export function ContinueCard({ initial }: { initial: EntryDTO }) {
  const kind = initial.mediaType
  const { entry, save, pending, error } = useEntry(kind, initial.malId, initial)
  if (!entry) return null
  const done = entry.status === 'completed'
  const unit = kind === 'anime' ? 'Ep' : 'Ch'
  return (
    <div className="flex h-full gap-3 rounded-xl border border-line bg-surface p-3">
      <Link {...detailLink(kind, entry.malId)} aria-label={`View ${entry.title}`} className="shrink-0 rounded-lg">
        <Img src={entry.imageUrl} alt="" className="h-24 w-16 rounded-lg" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <Link
          {...detailLink(kind, entry.malId)}
          className="line-clamp-2 text-sm leading-snug font-bold hover:text-accent-text"
        >
          {entry.title}
        </Link>
        <p className="mt-1 font-mono text-xs text-muted">
          {done
            ? 'Completed'
            : `${unit} ${entry.progress}${entry.total ? ` / ${entry.total}` : ''}`}
        </p>
        <div className="mt-auto flex items-center gap-2 pt-2">
          <div className="flex-1">
            <EpisodeRibbon
              progress={entry.progress}
              total={entry.total}
              kind={kind}
              size="sm"
              color={statusColor[entry.status]}
            />
          </div>
          <button
            type="button"
            disabled={pending || done}
            onClick={() => save({ progressDelta: 1 })}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-accent px-2 font-mono text-xs font-semibold text-on-accent transition hover:brightness-105 disabled:opacity-50"
            aria-label={`Mark ${kind === 'anime' ? 'episode' : 'chapter'} ${entry.progress + 1} of ${entry.title} as ${kind === 'anime' ? 'watched' : 'read'}`}
          >
            {pending ? (
              <Loader2 className="size-3 animate-spin" aria-hidden />
            ) : (
              <Plus className="size-3" aria-hidden />
            )}
            1
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-1 text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
