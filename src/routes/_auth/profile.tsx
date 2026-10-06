import { useState } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { Loader2, Pencil } from 'lucide-react'
import { getProfile } from '#/lib/tracking.functions'
import { getAuthOptions, updateProfile } from '#/lib/auth.functions'
import { VerificationNotice } from '#/components/VerificationNotice'
import { listStatuses, statusColor, statusLabel } from '#/lib/status'
import { formatJoined } from '#/lib/format'
import { resetSession } from '#/lib/session'
import { detailLink } from '#/components/media'
import { HistoryItem } from '#/components/HistoryItem'
import {
  Container,
  EmptyState,
  Img,
  SectionHeading,
  btn,
  field,
  formatNumber,
} from '#/components/ui'
import type { MediaKind } from '#/lib/media'
import type { SessionUser } from '#/lib/auth.functions'

export const Route = createFileRoute('/_auth/profile')({
  loader: async () => {
    const [profile, authOptions] = await Promise.all([getProfile(), getAuthOptions()])
    return { ...profile, authOptions }
  },
  head: () => ({ meta: [{ title: 'Profile · Newarix' }] }),
  pendingComponent: () => (
    <Container className="py-10">
      <div className="flex items-center gap-5">
        <div className="skeleton size-24 rounded-full" />
        <div className="skeleton h-10 w-48 rounded" />
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <div className="skeleton h-48 rounded-2xl" />
        <div className="skeleton h-48 rounded-2xl" />
      </div>
    </Container>
  ),
  component: ProfilePage,
})

type Profile = Awaited<ReturnType<typeof getProfile>>
type MediaStats = Profile['anime']

function EditProfile({
  user,
  onDone,
}: {
  user: SessionUser
  onDone: () => void
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setPending(true)
    setError(null)
    try {
      const res = await updateProfile({
        data: form,
      })
      if (!res.ok) return setError(res.error)
      resetSession()
      await router.invalidate()
      onDone()
    } catch {
      setError('Could not save your profile. Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-6 grid max-w-xl gap-4 rounded-2xl border border-line bg-surface p-5"
    >
      <label className="text-sm font-semibold">
        Username
        <input
          name="username"
          defaultValue={user.username}
          required
          className={`${field} mt-1.5`}
          autoComplete="username"
        />
      </label>
      <label className="text-sm font-semibold">
        Upload avatar
        <input name="avatar" type="file" accept="image/jpeg,image/png,image/webp" className={`${field} mt-1.5`} aria-describedby="avatar-hint" />
        <span id="avatar-hint" className="mt-1 block text-xs font-normal text-muted">JPEG, PNG or WebP, up to 5 MB. A selected file replaces the URL when you save.</span>
      </label>
      <label className="text-sm font-semibold">
        Avatar image URL
        <input
          name="avatarUrl"
          type="text"
          defaultValue={user.avatarUrl ?? ''}
          placeholder="https://…"
          className={`${field} mt-1.5`}
        />
      </label>
      <label className="text-sm font-semibold">
        Bio
        <textarea
          name="bio"
          rows={3}
          maxLength={300}
          defaultValue={user.bio ?? ''}
          className={`${field} mt-1.5`}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={btn.primary}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}{' '}
          Save profile
        </button>
        <button type="button" onClick={onDone} className={btn.ghost}>
          Cancel
        </button>
      </div>
    </form>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="mt-1 font-mono text-2xl font-semibold">{value}</dd>
    </div>
  )
}

function MediaStatsCard({
  kind,
  stats,
}: {
  kind: MediaKind
  stats: MediaStats
}) {
  const anime = kind === 'anime'
  return (
    <section
      aria-label={`${kind} stats`}
      className="rounded-2xl border border-line bg-surface p-5"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl capitalize">{kind}</h2>
        <Link
          to="/list"
          search={{ kind }}
          className="text-sm font-semibold text-muted hover:text-accent-text"
        >
          View list
        </Link>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-4">
        <Tile label="Titles" value={formatNumber(stats.total)} />
        <Tile
          label={anime ? 'Episodes watched' : 'Chapters read'}
          value={formatNumber(stats.progress)}
        />
        <Tile
          label="Mean score"
          value={stats.meanScore ? stats.meanScore.toFixed(2) : '—'}
        />
      </dl>
      {stats.total > 0 && (
        <>
          <div
            className="mt-5 flex h-2.5 gap-[2px] overflow-hidden rounded"
            aria-hidden
          >
            {listStatuses.map((s) =>
              stats.byStatus[s] ? (
                <span
                  key={s}
                  className="first:rounded-l last:rounded-r"
                  style={{
                    flexGrow: stats.byStatus[s],
                    background: statusColor[s],
                  }}
                />
              ) : null,
            )}
          </div>
          <ul
            className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs"
            aria-label="Titles by status"
          >
            {listStatuses.map((s) => (
              <li key={s} className="flex items-center gap-1.5 text-muted">
                <span
                  className="size-2 rounded-full"
                  style={{ background: statusColor[s] }}
                  aria-hidden
                />
                {statusLabel(s, kind)}{' '}
                <span className="font-mono font-semibold text-text">
                  {stats.byStatus[s]}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {!anime && stats.volumes > 0 && (
        <p className="mt-3 text-xs text-muted">
          {formatNumber(stats.volumes)}{' '}
          {stats.volumes === 1 ? 'volume' : 'volumes'} read
        </p>
      )}
    </section>
  )
}

function GenreChart({ genres }: { genres: Profile['genres'] }) {
  const max = Math.max(...genres.map((g) => g.n), 1)
  return (
    <ol className="flex flex-col gap-2.5">
      {genres.map((g) => (
        <li
          key={g.name}
          className="group grid grid-cols-[7.5rem_1fr_auto] items-center gap-3 text-sm"
        >
          <span className="truncate text-muted">{g.name}</span>
          <span className="relative h-3">
            <span
              className="absolute inset-y-0 left-0 rounded-r-[4px] transition group-hover:brightness-110"
              style={{
                width: `${(g.n / max) * 100}%`,
                background: 'var(--chart)',
                minWidth: 4,
              }}
            />
          </span>
          <span className="w-24 text-right font-mono text-xs">
            <span className="font-semibold">{g.n}</span>
            <span className="text-muted">
              {g.mean ? ` · avg ${g.mean}` : ''}
            </span>
          </span>
        </li>
      ))}
    </ol>
  )
}

function ScoreChart({ data }: { data: Profile['scoreDistribution'] }) {
  const max = Math.max(...data.map((d) => d.n), 1)
  return (
    <figure>
      <div className="flex h-36 items-end gap-1.5 border-b border-line">
        {data.map((d, i) => (
          <div
            key={d.score}
            className="group relative flex h-full flex-1 items-end justify-center"
          >
            <span
              className="w-full max-w-8 rounded-t-[4px] transition group-hover:brightness-110"
              style={{
                height: d.n ? `${Math.max((d.n / max) * 100, 3)}%` : 0,
                background: 'var(--chart)',
              }}
            />
            <span
              className={`pointer-events-none absolute -top-1 -translate-y-full rounded ${i < 2 ? 'left-0' : i > 7 ? 'right-0' : ''} bg-text px-1.5 py-0.5 font-mono text-[11px] whitespace-nowrap text-bg opacity-0 transition group-hover:opacity-100`}
            >
              {d.n} {d.n === 1 ? 'title' : 'titles'}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5" aria-hidden>
        {data.map((d) => (
          <span
            key={d.score}
            className="flex-1 text-center font-mono text-xs text-muted"
          >
            {d.score}
          </span>
        ))}
      </div>
      <figcaption className="sr-only">
        Your scores:{' '}
        {data.map((d) => `${d.n} titles scored ${d.score}`).join(', ')}.
      </figcaption>
    </figure>
  )
}

function ProfilePage() {
  const p = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const [editing, setEditing] = useState(false)
  const scored = p.scoreDistribution.some((d) => d.n > 0)
  const me = user

  return (
    <Container className="py-10">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
        {me.avatarUrl ? (
          <Img
            src={me.avatarUrl}
            alt=""
            eager
            className="size-24 rounded-full ring-2 ring-line"
          />
        ) : (
          <span
            aria-hidden
            className="grid size-24 place-items-center rounded-full bg-raised font-display text-4xl text-accent-text ring-2 ring-line"
          >
            {me.username.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="flex-1">
          <h1 className="font-display text-3xl sm:text-4xl">{me.username}</h1>
          <p className="mt-1 text-sm text-muted">
            Joined {formatJoined(me.createdAt)}
          </p>
          {me.bio && <p className="mt-2 max-w-xl text-sm">{me.bio}</p>}
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={`${btn.ghost} self-start sm:self-center`}
          >
            <Pencil className="size-4" aria-hidden /> Edit profile
          </button>
        )}
      </header>
      {editing && <EditProfile user={me} onDone={() => setEditing(false)} />}
      <VerificationNotice user={me} emailAvailable={p.authOptions.email} />
      {p.authOptions.google && <div className="mt-4 text-sm">{me.googleConnected ? <p className="text-muted">Google account connected.</p> : <a href="/api/auth/google" className={btn.ghost}>Connect Google account</a>}</div>}

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <MediaStatsCard kind="anime" stats={p.anime} />
        <MediaStatsCard kind="manga" stats={p.manga} />
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="genres">
          <SectionHeading title="Top genres" id="genres" />
          {p.genres.length ? (
            <GenreChart genres={p.genres} />
          ) : (
            <p className="text-sm text-muted">
              Start watching or reading something to see which genres you favor.
            </p>
          )}
        </section>
        <section aria-labelledby="scores">
          <SectionHeading title="How you score" id="scores" />
          {scored ? (
            <ScoreChart data={p.scoreDistribution} />
          ) : (
            <p className="text-sm text-muted">
              Rate a title from its page to see your score spread.
            </p>
          )}
        </section>
      </div>

      <section className="mt-12" aria-labelledby="favorites">
        <SectionHeading title="Favorites" id="favorites" />
        {p.favorites.length ? (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
            {p.favorites.map((f) => (
              <li key={`${f.mediaType}-${f.malId}`}>
                <Link
                  {...detailLink(f.mediaType, f.malId)}
                  className="group block rounded-lg"
                  title={f.title}
                >
                  <Img
                    src={f.imageUrl}
                    alt={f.title}
                    className="aspect-[2/3] w-full rounded-lg ring-1 ring-line transition group-hover:ring-2 group-hover:ring-accent"
                  />
                  <p className="mt-1.5 line-clamp-2 text-xs font-semibold">
                    {f.title}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No favorites yet"
            message="Tap the heart on any anime or manga page to pin it here."
          />
        )}
      </section>

      <section className="mt-12 max-w-3xl" aria-labelledby="recent">
        <SectionHeading
          title="Recent activity"
          id="recent"
          action={
            <Link
              to="/history"
              className="text-sm font-semibold text-muted hover:text-accent-text"
            >
              Full history
            </Link>
          }
        />
        {p.recent.length ? (
          <ol className="relative before:absolute before:top-0 before:bottom-0 before:left-[4px] before:w-px before:bg-line">
            {p.recent.map((h) => (
              <HistoryItem key={h.id} h={h} showTime={false} />
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted">Nothing logged yet.</p>
        )}
      </section>
    </Container>
  )
}
