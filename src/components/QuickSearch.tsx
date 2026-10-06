import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Loader2, Search } from 'lucide-react'
import { quickSearch } from '#/lib/catalog.functions'
import { displayTitle } from '#/lib/media'
import { useDebounced } from '#/lib/hooks'
import { Img } from './ui'
import type { MediaCard } from '#/lib/media'

/** Navbar search with debounced suggestions (ARIA combobox pattern). */
export function QuickSearch({ onDone }: { onDone?: () => void }) {
  const navigate = useNavigate()
  const listId = useId()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [results, setResults] = useState<MediaCard[]>([])
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const debounced = useDebounced(q.trim(), 350)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (debounced.length < 2) {
      setResults([])
      setState('idle')
      return
    }
    let cancelled = false
    setState('loading')
    quickSearch({ data: { q: debounced } })
      .then((r) => {
        if (cancelled) return
        setResults(r)
        setActive(-1)
        setState('idle')
      })
      .catch(() => !cancelled && setState('error'))
    return () => {
      cancelled = true
    }
  }, [debounced])

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const finish = () => {
    setOpen(false)
    setQ('')
    onDone?.()
  }

  const go = (m: MediaCard) => {
    void navigate({
      to: m.kind === 'anime' ? '/anime/$id' : '/manga/$id',
      params: { id: String(m.id) },
    })
    finish()
  }

  const submit = () => {
    if (active >= 0 && results[active]) return go(results[active])
    void navigate({
      to: '/search',
      search: { kind: 'anime', q: q.trim() || undefined },
    })
    finish()
  }

  const showList = open && debounced.length >= 2

  return (
    <div ref={boxRef} className="relative w-full">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <label htmlFor={`${listId}-input`} className="sr-only">
          Search anime and manga
        </label>
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <input
          id={`${listId}-input`}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            active >= 0 ? `${listId}-${active}` : undefined
          }
          autoComplete="off"
          placeholder="Search titles…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setOpen(true)
              setActive((a) => Math.min(a + 1, results.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(a - 1, -1))
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
          className="h-10 w-full rounded-lg border border-line bg-surface pr-9 pl-9 text-sm text-text placeholder:text-muted/70 focus:border-accent focus:outline-none"
        />
        {state === 'loading' && (
          <Loader2
            className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted"
            aria-label="Searching"
          />
        )}
      </form>
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Suggestions"
          className="absolute top-full right-0 left-0 z-50 mt-2 max-h-[70vh] overflow-auto rounded-xl border border-line bg-surface p-1.5 shadow-card"
        >
          {state === 'error' && (
            <li className="px-3 py-4 text-sm text-muted">
              Search is unavailable right now.
            </li>
          )}
          {state !== 'error' && results.length === 0 && state !== 'loading' && (
            <li className="px-3 py-4 text-sm text-muted">
              No titles match “{debounced}”.
            </li>
          )}
          {results.map((m, i) => (
            <li
              key={`${m.kind}-${m.id}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(m)}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-3 rounded-lg p-2 ${i === active ? 'bg-raised' : ''}`}
            >
              <Img
                src={m.image}
                alt=""
                className="h-14 w-10 shrink-0 rounded"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {displayTitle(m)}
                </p>
                <p className="truncate text-xs text-muted">
                  <span className="font-semibold uppercase">{m.kind}</span>
                  {m.type && ` · ${m.type}`}
                  {m.year && ` · ${m.year}`}
                </p>
              </div>
            </li>
          ))}
          {results.length > 0 && (
            <li
              role="presentation"
              className="border-t border-line px-3 pt-2 pb-1 text-xs text-muted"
            >
              Press Enter to see all results
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
