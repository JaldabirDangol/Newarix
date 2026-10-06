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
      const pick = result.ok ? result.items[0] : null
      return pick ? getAnime({ data: { id: pick.id } }).catch(() => null) : null
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

function Hero({ anime }: { anime: AnimeDetail }) {
  const title = displayTitle(anime)
  const season =
    anime.season && anime.year
      ? `${anime.season[0].toUpperCase()}${anime.season.slice(1)} ${anime.year}`
      : 'This season'
  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate overflow-hidden border-b border-line"
    >
      <Img
        src={anime.imageLarge}
        alt=""
        eager
        className="absolute inset-0 -z-20 h-full w-full scale-110 opacity-40 blur-2xl"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-bg via-bg/90 to-bg/40" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-bg via-transparent to-transparent" />
      <Container className="grid items-end gap-8 py-10 sm:py-14 md:grid-cols-[auto_1fr] md:py-16">
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
        <div className="max-w-2xl animate-rise">
          <p className="font-mono text-xs tracking-widest text-accent-text uppercase">
            Most watched · {season}
          </p>
          <h1
            id="hero-title"
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
      {anime.broadcast && anime.airing && (
        <p className="subtitle-line pb-5 text-center text-sm sm:text-base">
          Next: {anime.broadcast}
        </p>
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
      <Await promise={hero} fallback={<div className="skeleton h-72" />}>
        {(item) =>
          item ? (
            <Hero anime={item} />
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
          <Await promise={continueItems} fallback={<RowSkeleton />}>
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
          fallback={
            <div className="mt-12">
              <RowSkeleton />
            </div>
          }
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
        <Await
          promise={airing}
          fallback={
            <div className="mt-12">
              <RowSkeleton />
            </div>
          }
        >
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
          fallback={
            <div className="mt-12">
              <RowSkeleton />
            </div>
          }
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
          fallback={
            <div className="mt-12">
              <RowSkeleton />
            </div>
          }
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
          fallback={
            <div className="mt-12">
              <RowSkeleton />
            </div>
          }
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

function HomeSkeleton() {
  return (
    <>
      <div className="border-b border-line">
        <Container className="grid gap-8 py-14 md:grid-cols-[auto_1fr]">
          <div className="skeleton hidden aspect-[2/3] w-56 rounded-xl md:block lg:w-64" />
          <div className="self-end">
            <div className="skeleton h-3 w-40 rounded" />
            <div className="skeleton mt-4 h-12 w-3/4 rounded" />
            <div className="skeleton mt-4 h-4 w-full max-w-xl rounded" />
            <div className="skeleton mt-2 h-4 w-2/3 max-w-xl rounded" />
          </div>
        </Container>
      </div>
      <Container>
        {[0, 1].map((i) => (
          <div key={i} className="mt-12">
            <div className="skeleton mb-4 h-6 w-48 rounded" />
            <RowSkeleton />
          </div>
        ))}
      </Container>
    </>
  )
}
