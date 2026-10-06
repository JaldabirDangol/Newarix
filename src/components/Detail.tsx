import { useState } from 'react'
import { Await, Link } from '@tanstack/react-router'
import { ExternalLink, Heart, Play, Star } from 'lucide-react'
import { displayTitle } from '#/lib/media'
import { detailLink } from './media'
import { RecommendationShelf } from './RecommendationShelf'
import { DetailTabs } from './DetailTabs'
import { TrackerPanel } from './tracking'
import { Container, Img, RowSkeleton, SectionHeading, formatNumber } from './ui'
import type {
  AnimeDetail,
  Character,
  MangaDetail,
  Recommendation,
} from '#/lib/media'
import type { EntryDTO } from '#/lib/tracking.functions'
import type { ReactNode } from 'react'

type Extras = {
  characters: Character[] | null
  recommendations: Recommendation[] | null
}
type Tracking = { loggedIn: boolean; entry: EntryDTO | null; favorite: boolean }

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string
  value: ReactNode
  accent?: boolean
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold tracking-wider text-muted uppercase">
        {label}
      </dt>
      <dd
        className={`mt-1 truncate font-mono text-lg font-semibold ${accent ? 'text-accent-text' : ''}`}
      >
        {value}
      </dd>
    </div>
  )
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  if (
    children === null ||
    children === undefined ||
    children === '' ||
    (Array.isArray(children) && !children.length)
  ) {
    return null
  }
  return (
    <div className="flex justify-between gap-4 border-b border-line py-2.5 text-sm last:border-0">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  )
}

function Synopsis({ text }: { text: string | null }) {
  const [open, setOpen] = useState(false)
  if (!text)
    return <p className="text-muted">No synopsis has been written yet.</p>
  const long = text.length > 600
  return (
    <div>
      <p
        className={`leading-relaxed whitespace-pre-line text-text/90 ${long && !open ? 'line-clamp-6' : ''}`}
      >
        {text}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-2 text-sm font-semibold text-accent-text hover:underline"
        >
          {open ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  )
}

/** Loads the YouTube player only after a click. */
function Trailer({ id, title }: { id: string; title: string }) {
  const [playing, setPlaying] = useState(false)
  return (
    <div className="relative aspect-video overflow-hidden rounded-xl bg-raised ring-1 ring-line">
      {playing ? (
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={`${title} trailer`}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group absolute inset-0"
          aria-label={`Play ${title} trailer`}
        >
          <Img
            src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
            alt=""
            className="h-full w-full opacity-80 transition group-hover:opacity-100"
          />
          <span className="absolute top-1/2 left-1/2 grid size-16 -translate-1/2 place-items-center rounded-full bg-accent text-on-accent shadow-card transition group-hover:scale-110">
            <Play className="ml-1 size-7 fill-current" aria-hidden />
          </span>
        </button>
      )}
    </div>
  )
}

function Characters({ items }: { items: Character[] }) {
  if (!items.length)
    return <p className="text-sm text-muted">No characters listed yet.</p>
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((c) => (
        <li
          key={c.id}
          className="flex items-center gap-3 rounded-xl bg-surface p-2 ring-1 ring-line"
        >
          <Img src={c.image} alt="" className="h-16 w-12 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{c.name}</p>
            <p className="text-xs text-muted">{c.role}</p>
          </div>
          {c.voiceActor && (
            <>
              <div className="min-w-0 flex-1 text-right">
                <p className="truncate text-sm font-semibold">
                  {c.voiceActor.name}
                </p>
                <p className="text-xs text-muted">Voice</p>
              </div>
              <Img
                src={c.voiceActor.image}
                alt=""
                className="h-16 w-12 shrink-0 rounded-md"
              />
            </>
          )}
        </li>
      ))}
    </ul>
  )
}

function ExtrasSkeleton() {
  return (
    <div
      className="grid gap-3 sm:grid-cols-2"
      role="status"
      aria-label="Loading characters"
    >
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="skeleton h-20 rounded-xl" />
      ))}
    </div>
  )
}

export function DetailPage({
  media,
  tracking,
  extras,
}: {
  media: AnimeDetail | MangaDetail
  tracking: Tracking
  extras: Promise<Extras>
}) {
  const title = displayTitle(media)
  const isAnime = media.kind === 'anime'
  const relations = media.relations.filter((r) => r.entries.length)

  return (
    <article>
      <div className="relative isolate h-40 overflow-hidden sm:h-56">
        <Img
          src={media.imageLarge}
          alt=""
          eager
          className="absolute inset-0 -z-10 h-full w-full scale-125 opacity-50 blur-2xl"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-bg" />
      </div>
      <Container className="relative -mt-28 grid gap-8 sm:-mt-36 lg:grid-cols-[280px_1fr] lg:gap-12">
        <aside className="flex flex-col gap-5">
          <div className="flex items-end gap-4 lg:block">
            <Img
              src={media.imageLarge}
              alt={`${title} ${isAnime ? 'poster' : 'cover'}`}
              eager
              className="aspect-[2/3] w-32 shrink-0 rounded-xl shadow-card ring-1 ring-line sm:w-44 lg:w-full"
            />
            <div className="pb-1 lg:hidden">
              <h1 className="font-display text-2xl leading-tight sm:text-3xl">
                {title}
              </h1>
              {media.titleEnglish && media.titleEnglish !== media.title && (
                <p className="mt-1 text-sm text-muted">{media.title}</p>
              )}
            </div>
          </div>
          <TrackerPanel
            key={`${media.kind}-${media.id}`}
            kind={media.kind}
            id={media.id}
            total={media.count}
            totalVolumes={media.kind === 'manga' ? media.volumes : null}
            loggedIn={tracking.loggedIn}
            initialEntry={tracking.entry}
            initialFavorite={tracking.favorite}
          />
          <dl className="rounded-2xl border border-line bg-surface px-4 py-1.5">
            <InfoRow label="Format">{media.type}</InfoRow>
            {media.kind === 'anime' ? (
              <>
                <InfoRow label="Episodes">
                  {media.count ?? (media.airing ? 'Airing' : '?')}
                </InfoRow>
                <InfoRow label="Status">{media.status}</InfoRow>
                <InfoRow label="Aired">{media.aired}</InfoRow>
                <InfoRow label="Next episode">{media.broadcast}</InfoRow>
                <InfoRow label="Duration">{media.duration}</InfoRow>
                <InfoRow label="Studios">{media.studios.join(', ')}</InfoRow>
                <InfoRow label="Source">{media.source}</InfoRow>
                <InfoRow label="Rating">{media.rating}</InfoRow>
              </>
            ) : (
              <>
                <InfoRow label="Chapters">
                  {media.count ?? (media.publishing ? 'Publishing' : '?')}
                </InfoRow>
                <InfoRow label="Volumes">{media.volumes}</InfoRow>
                <InfoRow label="Status">{media.status}</InfoRow>
                <InfoRow label="Published">{media.published}</InfoRow>
                <InfoRow label="Authors">{media.authors.join(' · ')}</InfoRow>
                <InfoRow label="Serialized in">
                  {media.serializations.join(', ')}
                </InfoRow>
              </>
            )}
            <InfoRow label="Demographic">
              {media.demographics.join(', ')}
            </InfoRow>
            <InfoRow label="Japanese">{media.titleJapanese}</InfoRow>
          </dl>
        </aside>

        <div className="min-w-0 lg:pt-36">
          <header className="hidden lg:block">
            <h1 className="font-display text-4xl leading-tight xl:text-5xl">
              {title}
            </h1>
            {media.titleEnglish && media.titleEnglish !== media.title && (
              <p className="mt-2 text-muted">{media.title}</p>
            )}
          </header>

          <dl className="mt-6 grid grid-cols-3 gap-4 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-5 lg:mt-6">
            <Stat
              label="Score"
              accent
              value={
                media.score ? (
                  <span className="flex items-center gap-1">
                    <Star className="size-4 fill-current" aria-hidden />
                    {media.score.toFixed(1)}
                  </span>
                ) : (
                  '—'
                )
              }
            />
            <Stat
              label="Ranked"
              value={media.rank ? `#${formatNumber(media.rank)}` : '—'}
            />
            <Stat
              label="Popularity"
              value={
                media.popularity ? `#${formatNumber(media.popularity)}` : '—'
              }
            />
            <Stat label="Members" value={formatNumber(media.members)} />
            <Stat
              label="Favorites"
              value={
                <span className="flex items-center gap-1">
                  <Heart className="size-3.5" aria-hidden />
                  {formatNumber(media.favorites)}
                </span>
              }
            />
          </dl>
          {media.scoredBy ? (
            <p className="mt-2 text-xs text-muted">
              Average of {formatNumber(media.scoredBy)} AniList user scores.
            </p>
          ) : null}

          <ul
            className="mt-6 flex flex-wrap gap-2"
            aria-label="Genres and themes"
          >
            {media.genres.map((g) => (
              <li
                key={g}
                className="rounded-full bg-raised px-3 py-1 text-xs font-semibold"
              >
                {g}
              </li>
            ))}
            {media.themes.map((g) => (
              <li
                key={g}
                className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted"
              >
                {g}
              </li>
            ))}
          </ul>

          <section className="mt-8" aria-labelledby="synopsis">
            <h2 id="synopsis" className="mb-3 text-lg font-extrabold">
              Synopsis
            </h2>
            <Synopsis text={media.synopsis} />
          </section>

          <DetailTabs
            key={`${media.kind}:${media.id}`}
            id={media.id}
            kind={media.kind}
            title={title}
            total={
              media.kind === 'anime' && media.status === 'Not yet released'
                ? 0
                : media.count
            }
          />

          {media.kind === 'anime' && media.trailerId && (
            <section className="mt-10" aria-labelledby="trailer">
              <h2 id="trailer" className="mb-3 text-lg font-extrabold">
                Trailer
              </h2>
              <Trailer id={media.trailerId} title={title} />
            </section>
          )}

          <Await
            promise={extras}
            fallback={
              <section className="mt-10">
                <SectionHeading title="Characters" />
                <ExtrasSkeleton />
              </section>
            }
          >
            {(x) => (
              <section className="mt-10" aria-labelledby="characters">
                <SectionHeading title="Characters" id="characters" />
                {x.characters ? (
                  <Characters items={x.characters} />
                ) : (
                  <p className="text-sm text-muted">
                    Characters couldn't be loaded right now.
                  </p>
                )}
              </section>
            )}
          </Await>

          {relations.length > 0 && (
            <section className="mt-10" aria-labelledby="related">
              <h2 id="related" className="mb-3 text-lg font-extrabold">
                Related
              </h2>
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
                {relations.map((r) => (
                  <div key={r.relation} className="contents">
                    <dt className="font-semibold text-muted">{r.relation}</dt>
                    <dd className="flex flex-wrap gap-x-3 gap-y-1">
                      {r.entries.map((e) => (
                        <Link
                          key={`${e.kind}-${e.id}`}
                          {...detailLink(e.kind, e.id)}
                          className="hover:text-accent-text hover:underline"
                        >
                          {e.name}
                          {e.kind !== media.kind && (
                            <span className="ml-1 text-xs text-muted uppercase">
                              ({e.kind})
                            </span>
                          )}
                        </Link>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {media.background && (
            <section className="mt-10" aria-labelledby="background">
              <h2 id="background" className="mb-3 text-lg font-extrabold">
                Background
              </h2>
              <p className="text-sm leading-relaxed text-muted">
                {media.background}
              </p>
            </section>
          )}

          <p className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
            <a
              href={media.siteUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-text"
            >
              View on AniList <ExternalLink className="size-3.5" aria-hidden />
            </a>
            <a
              href={media.malUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-text"
            >
              View on MyAnimeList{' '}
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </p>
        </div>
      </Container>

      <Container>
        <Await
          promise={extras}
          fallback={
            <section className="mt-14">
              <SectionHeading title="If you like this" />
              <RowSkeleton />
            </section>
          }
        >
          {(x) =>
            x.recommendations && x.recommendations.length > 0 ? (
              <section className="mt-14" aria-label="Recommendations">
                <SectionHeading title="If you like this" />
                <RecommendationShelf items={x.recommendations} />
              </section>
            ) : null
          }
        </Await>
      </Container>
    </article>
  )
}

export function DetailSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <div className="h-40 sm:h-56" />
      <Container className="-mt-28 grid gap-8 sm:-mt-36 lg:grid-cols-[280px_1fr] lg:gap-12">
        <div className="flex flex-col gap-5">
          <div className="skeleton aspect-[2/3] w-32 rounded-xl sm:w-44 lg:w-full" />
          <div className="skeleton h-40 rounded-2xl" />
        </div>
        <div className="lg:pt-36">
          <div className="skeleton h-12 w-3/4 rounded" />
          <div className="skeleton mt-6 h-20 rounded-2xl" />
          <div className="skeleton mt-8 h-4 w-full rounded" />
          <div className="skeleton mt-2 h-4 w-full rounded" />
          <div className="skeleton mt-2 h-4 w-2/3 rounded" />
        </div>
      </Container>
    </div>
  )
}
