import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { saveEntry } from '#/lib/tracking.functions'
import { listStatuses, statusLabel } from '#/lib/status'
import { btn, field } from './ui'
import type { EntryDTO } from '#/lib/tracking.functions'
import type { ListStatus } from '#/lib/status'

export function QuickEdit({ entry }: { entry: EntryDTO }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    setPending(true)
    setError('')
    try {
      await saveEntry({
        data: {
          kind: entry.mediaType,
          id: entry.malId,
          status: String(values.get('status')) as ListStatus,
          score: values.get('score') ? Number(values.get('score')) : null,
          progress: Number(values.get('progress')),
        },
      })
      await router.invalidate()
      setOpen(false)
    } catch {
      setError('Could not save this entry. Try again.')
    } finally {
      setPending(false)
    }
  }
  if (!open)
    return (
      <button
        type="button"
        className={btn.ghost}
        aria-label={`Quick edit ${entry.title}`}
        onClick={() => setOpen(true)}
      >
        Edit
      </button>
    )
  return (
    <form
      onSubmit={save}
      aria-label={`Edit ${entry.title}`}
      className="flex flex-wrap items-end gap-3"
      aria-busy={pending}
    >
      <label className="text-xs font-semibold">
        Status
        <select
          name="status"
          defaultValue={entry.status}
          className={`${field} mt-1`}
          disabled={pending}
        >
          {listStatuses.map((status) => (
            <option key={status} value={status}>
              {statusLabel(status, entry.mediaType)}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold">
        {entry.mediaType === 'anime' ? 'Episodes' : 'Chapters'}
        <input
          name="progress"
          type="number"
          min={0}
          max={entry.total ?? 100000}
          defaultValue={entry.progress}
          className={`${field} mt-1 w-24`}
          required
          disabled={pending}
        />
      </label>
      <label className="text-xs font-semibold">
        Your score
        <select
          name="score"
          defaultValue={entry.score ?? ''}
          className={`${field} mt-1 w-28`}
          disabled={pending}
        >
          <option value="">Unrated</option>
          {Array.from({ length: 10 }, (_, i) => (
            <option key={i} value={i + 1}>
              {i + 1} / 10
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className={btn.primary} disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </button>
      <button
        type="button"
        className={btn.ghost}
        disabled={pending}
        onClick={() => setOpen(false)}
      >
        Cancel
      </button>
      {error && (
        <p role="alert" className="w-full text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  )
}
