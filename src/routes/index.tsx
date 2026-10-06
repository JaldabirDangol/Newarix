import { useEffect, useState } from 'react'
import { Await, Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, Star, Users } from 'lucide-react'
import { getAnime, getHomeShelf } from '#/lib/catalog.functions'
import { getContinue } from '#/lib/tracking.functions'
import { displayTitle } from '#/lib/media'
import { PosterShelf, Shelf } from '#/components/media'
import { ContinueCard } from '#/components/tracking'
import {
  Container,
  ErrorState,
  Img,
  RowSkeleton,
  SectionHeading,
  btn,
  formatNumber,
} from '#/components/ui'
import type { Section } from '#/lib/catalog.functions'
import type { AnimeDetail } from '#/lib/media'

export const Route = createFileRoute('/')({
  loader: ({ context }) => {
    const season = getHomeShelf({ data: { shelf: 'season' } })
    const hero = season.then(async (result) => {
      const picks = result.ok ? result.items.slice(0, 3) : []
      const details = await Promise.all(
        picks.map((pick) =>
          getAnime({ data: { id: pick.id } }).catch(() => null),
        ),
      )
      return details.filter((anime): anime is AnimeDetail => anime !== null)
    })
    return {
      hero,
      season,
      airing: getHomeShelf({ data: { shelf: 'airing' } }),
      top: getHomeShelf({ data: { shelf: 'top' } }),
      upcoming: getHomeShelf({ data: { shelf: 'upcoming' } }),
      manga: getHomeShelf({ data: { shelf: 'manga' } }),
      continueItems: context.user ? getContinue() : Promise.resolve([]),
    }
  },
  pendingComponent: HomeSkeleton,
  component: Home,
})

function Hero({
  anime,
  index,
  active,
  count,
}: {
  anime: AnimeDetail
  index: number
  active: boolean
  count: number
}) {
  const title = displayTitle(anime)
  const season =
    anime.season && anime.year
      ? `${anime.season[0].toUpperCase()}${anime.season.slice(1)} ${anime.year}`
      : 'This season'
  return (
    <section
      aria-labelledby={`hero-title-${index}`}
      aria-roledescription="slide"
      aria-label={`${index + 1} of ${count}`}
      aria-hidden={!active}
      inert={!active}
      className="relative isolate flex w-full shrink-0 flex-col overflow-hidden"
    >
      <Img
        src={anime.imageLarge}
        alt=""
        eager
        className="absolute inset-0 -z-20 h-full w-full scale-110 opacity-40 blur-2xl"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-bg via-bg/90 to-bg/40" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-bg via-transparent to-transparent" />
      <Container className="grid flex-1 items-end gap-8 py-10 sm:py-14 md:grid-cols-[auto_1fr] md:py-16">
        <Link
          to="/anime/$id"
          params={{ id: String(anime.id) }}
          className="hidden rounded-xl md:block"
        >
          <Img
            src={anime.imageLarge}
            alt={`${title} poster`}
            eager
            className="aspect-[2/3] w-56 rounded-xl shadow-card ring-1 ring-line lg:w-64"
          />
        </Link>
        <div className="max-w-2xl">
          <p className="font-mono text-xs tracking-widest text-accent-text uppercase">
            Most watched · {season}
          </p>
          <h1
            id={`hero-title-${index}`}
            className="mt-3 font-display text-4xl leading-[1.05] sm:text-5xl lg:text-6xl"
          >
            {title}
          </h1>
          {anime.titleEnglish && anime.titleEnglish !== anime.title && (
            <p className="mt-2 text-sm text-muted">{anime.title}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {anime.score && (
              <span className="flex items-center gap-1 font-mono font-semibold text-accent-text">
                <Star className="size-4 fill-current" aria-hidden />{' '}
                {anime.score.toFixed(1)}
              </span>
            )}
            {anime.members && (
              <span className="flex items-center gap-1 text-muted">
                <Users className="size-4" aria-hidden />{' '}
                {formatNumber(anime.members)} members
              </span>
            )}
            {anime.studios[0] && (
              <span className="text-muted">{anime.studios[0]}</span>
            )}
            {anime.genres.slice(0, 3).map((g) => (
              <span
                key={g}
                className="rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold"
              >
                {g}
              </span>
            ))}
          </div>
          {anime.synopsis && (
            <p className="mt-4 line-clamp-3 text-base leading-relaxed text-muted">
              {anime.synopsis}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/anime/$id"
              params={{ id: String(anime.id) }}
              className={btn.primary}
            >
              View details <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link to="/schedule" className={btn.ghost}>
              This week's schedule
            </Link>
          </div>
        </div>
      </Container>
      <div className="min-h-10 px-4 pb-5 text-center">
        {anime.broadcast && anime.airing && (
          <p className="subtitle-line text-sm sm:text-base">
            Next: {anime.broadcast}
          </p>
        )}
      </div>
    </section>
  )
}

function HeroCarousel({ items }: { items: AnimeDetail[] }) {
  const [selected, setSelected] = useState(0)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const multiple = items.length > 1
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotion = () => setReducedMotion(preference.matches)
    const updateVisibility = () => setHidden(document.hidden)
    updateMotion()
    updateVisibility()
    preference.addEventListener('change', updateMotion)
    document.addEventListener('visibilitychange', updateVisibility)
    return () => {
      preference.removeEventListener('change', updateMotion)
      document.removeEventListener('visibilitychange', updateVisibility)
    }
  }, [])
  useEffect(() => {
    if (!multiple || hovered || focused || hidden || reducedMotion) return
    const timer = window.setTimeout(
      () => setSelected((current) => (current + 1) % items.length),
      3000,
    )
    return () => window.clearTimeout(timer)
  }, [
    multiple,
    hovered,
    focused,
    hidden,
    reducedMotion,
    selected,
    items.length,
  ])
  return (
    <section
      aria-label="Featured anime"
      aria-roledescription="carousel"
      className="overflow-hidden border-b border-line"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false)
      }}
    >
      <div
        className="flex items-stretch transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={{ transform: `translateX(-${selected * 100}%)` }}
      >
        {items.map((anime, index) => (
          <Hero
            key={anime.id}
            anime={anime}
            index={index}
            active={index === selected}
            count={items.length}
          />
        ))}
      </div>
      {multiple && (
        <Container className="flex items-center justify-center gap-3 pb-6">
          <div className="flex items-center gap-1">
            {items.map((anime, index) => (
              <button
                key={anime.id}
                type="button"
                className="group flex h-9 w-8 items-center justify-center rounded-lg"
                aria-label={`Show featured anime ${index + 1}: ${displayTitle(anime)}`}
                aria-pressed={selected === index}
                onClick={() => setSelected(index)}
              >
                <span
                  aria-hidden
                  className={`h-1.5 rounded-full transition-all motion-reduce:transition-none ${selected === index ? 'w-6 bg-accent' : 'w-2 bg-muted/50 group-hover:bg-muted'}`}
                />
              </button>
            ))}
          </div>
        </Container>
      )}
    </section>
  )
}

function ShelfSection({
  title,
  section,
  to,
  search,
}: {
  title: string
  section: Section
  to: string
  search?: Record<string, unknown>
}) {
  return (
    <section className="mt-12" aria-label={title}>
      <SectionHeading
        title={title}
        action={
          <Link
            to={to}
            search={search as never}
            className="flex items-center gap-1 text-sm font-semibold text-muted hover:text-accent-text"
          >
            See all <ArrowRight className="size-4" aria-hidden />
          </Link>
        }
      />
      {section.ok ? (
        section.items.length ? (
          <PosterShelf items={section.items.slice(0, 15)} label={title} />
        ) : (
          <p className="text-sm text-muted">Nothing here yet.</p>
        )
      ) : (
        <ErrorState
          title={`Couldn't load ${title.toLowerCase()}`}
          message={section.error}
        />
      )}
    </section>
  )
}

function Home() {
  const { hero, season, airing, top, upcoming, manga, continueItems } =
    Route.useLoaderData()
  const { user } = Route.useRouteContext()
  return (
    <>
      <Await promise={hero} fallback={<HeroSkeleton />}>
        {(items) =>
          items.length ? (
            <HeroCarousel items={items} />
          ) : (
            <Container className="pt-12">
              <h1 className="font-display text-4xl sm:text-5xl">
                Find your next favorite.
              </h1>
              <p className="mt-3 max-w-xl text-muted">
                Browse what's airing, then track every episode and chapter you
                get through.
              </p>
            </Container>
          )
        }
      </Await>
      <Container>
        {user && (
          <Await promise={continueItems} fallback={<ContinueSkeleton />}>
            {(items) =>
              items.length > 0 && (
                <section className="mt-10" aria-label="Continue watching">
                  <SectionHeading
                    title="Continue watching"
                    action={
                      <Link
                        to="/list"
                        search={{ kind: 'anime', status: 'current' }}
                        className="text-sm font-semibold text-muted hover:text-accent-text"
                      >
                        My list
                      </Link>
                    }
                  />
                  <Shelf label="Continue watching">
                    {items.map((e) => (
                      <li key={e.id} className="w-72 shrink-0 snap-start">
                        <ContinueCard initial={e} />
                      </li>
                    ))}
                  </Shelf>
                </section>
              )
            }
          </Await>
        )}
        {!user && (
          <section className="mt-10 flex flex-col items-start justify-between gap-4 rounded-2xl border border-line bg-surface p-6 sm:flex-row sm:items-center">
            <div>
              <p className="text-lg font-bold">Keep track of every episode</p>
              <p className="mt-1 text-sm text-muted">
                Make a free account to build your list, log progress and see
                your watch history.
              </p>
            </div>
            <Link to="/signup" className={`${btn.primary} shrink-0`}>
              Create an account
            </Link>
          </section>
        )}
        <Await
          promise={season}
          fallback={<ShelfSkeleton title="Popular this season" />}
        >
          {(section) => (
            <ShelfSection
              title="Popular this season"
              section={section}
              to="/search"
              search={{ kind: 'anime', status: 'airing', orderBy: 'members' }}
            />
          )}
        </Await>
        <Await promise={airing} fallback={<ShelfSkeleton title="Top airing" />}>
          {(section) => (
            <ShelfSection
              title="Top airing"
              section={section}
              to="/anime"
              search={{ filter: 'airing' }}
            />
          )}
        </Await>
        <Await
          promise={top}
          fallback={<ShelfSkeleton title="Top anime of all time" />}
        >
          {(section) => (
            <ShelfSection
              title="Top anime of all time"
              section={section}
              to="/anime"
            />
          )}
        </Await>
        <Await
          promise={upcoming}
          fallback={<ShelfSkeleton title="Coming soon" />}
        >
          {(section) => (
            <ShelfSection
              title="Coming soon"
              section={section}
              to="/anime"
              search={{ filter: 'upcoming' }}
            />
          )}
        </Await>
        <Await
          promise={manga}
          fallback={<ShelfSkeleton title="Popular manga" />}
        >
          {(section) => (
            <ShelfSection
              title="Popular manga"
              section={section}
              to="/manga"
              search={{ filter: 'bypopularity' }}
            />
          )}
        </Await>
      </Container>
    </>
  )
}

function HeroSkeleton() {
  return (
    <section
      className="border-b border-line"
      role="status"
      aria-label="Loading featured anime"
    >
      <Container className="grid items-end gap-8 py-10 sm:py-14 md:grid-cols-[auto_1fr] md:py-16">
        <div
          aria-hidden
          className="skeleton hidden aspect-[2/3] w-56 rounded-xl md:block lg:w-64"
        />
        <div aria-hidden className="w-full max-w-2xl">
          <div className="skeleton h-3 w-44 rounded" />
          <div className="skeleton mt-3 h-10 w-[85%] rounded-md sm:h-12 lg:h-16" />
          <div className="skeleton mt-2 h-10 w-[60%] rounded-md sm:h-12 lg:h-16" />
          <div className="mt-4 flex flex-wrap gap-3">
            {[48, 112, 80, 64].map((width) => (
              <div
                key={width}
                className="skeleton h-5 rounded-full"
                style={{ width }}
              />
            ))}
          </div>
          <div className="mt-5 space-y-2.5">
            <div className="skeleton h-3.5 w-full rounded" />
            <div className="skeleton h-3.5 w-[94%] rounded" />
            <div className="skeleton h-3.5 w-[72%] rounded" />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <div className="skeleton h-11 w-36 rounded-lg" />
            <div className="skeleton h-11 w-48 rounded-lg" />
          </div>
        </div>
      </Container>
      <div aria-hidden className="flex justify-center gap-3 pt-10 pb-6">
        <div className="skeleton h-1.5 w-16 rounded-full" />
      </div>
    </section>
  )
}

function ShelfSkeleton({ title }: { title: string }) {
  return (
    <section className="mt-12" aria-label={title} aria-busy="true">
      <SectionHeading
        title={title}
        action={<div aria-hidden className="skeleton h-3 w-16 rounded" />}
      />
      <RowSkeleton />
    </section>
  )
}

function ContinueSkeleton() {
  return (
    <section className="mt-10" aria-label="Continue watching" aria-busy="true">
      <SectionHeading title="Continue watching" />
      <div
        role="status"
        aria-label="Loading watch progress"
        className="flex gap-4 overflow-hidden"
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            aria-hidden
            className="flex w-72 shrink-0 gap-3 rounded-xl border border-line bg-surface p-3"
          >
            <div className="skeleton h-24 w-16 shrink-0 rounded-lg" />
            <div className="flex-1 pt-1">
              <div className="skeleton h-4 w-full rounded" />
              <div className="skeleton mt-2 h-3 w-3/4 rounded" />
              <div className="skeleton mt-4 h-2 w-full rounded" />
              <div className="skeleton mt-3 h-5 w-20 rounded" />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function HomeSkeleton() {
  return (
    <>
      <HeroSkeleton />
      <Container>
        {[
          'Popular this season',
          'Top airing',
          'Top anime of all time',
          'Coming soon',
          'Popular manga',
        ].map((title) => (
          <ShelfSkeleton key={title} title={title} />
        ))}
      </Container>
    </>
  )
}
