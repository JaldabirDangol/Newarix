import { Link, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { getSchedule } from '#/lib/catalog.functions'
import { scheduleDays } from '#/lib/filters'
import { displayTitle } from '#/lib/media'
import { useMounted } from '#/lib/hooks'
import {
  Container,
  EmptyState,
  Img,
  PageHeader,
  ScoreBadge,
} from '#/components/ui'
import type { ScheduleDay } from '#/lib/filters'

/** Today's weekday in Japan, where the broadcast times are set. */
function todayInJapan(): ScheduleDay {
  const name = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: 'Asia/Tokyo',
  }).format(new Date())
  return name.toLowerCase() as ScheduleDay
}

export const Route = createFileRoute('/schedule')({
  validateSearch: z.object({
    day: z.enum(scheduleDays).optional().catch(undefined),
  }),
  loaderDeps: ({ search }) => ({ day: search.day ?? todayInJapan() }),
  loader: async ({ deps }) => ({
    day: deps.day,
    items: await getSchedule({ data: { day: deps.day } }),
  }),
  staleTime: 10 * 60_000,
  head: () => ({ meta: [{ title: 'Airing schedule · Newarix' }] }),
  pendingComponent: () => (
    <Container className="py-10">
      <div className="skeleton mb-8 h-10 w-64 rounded" />
      <div className="skeleton mb-8 h-10 w-full rounded-lg" />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="skeleton mb-4 h-24 rounded-xl" />
      ))}
    </Container>
  ),
  component: SchedulePage,
})

const dayIndex: Record<ScheduleDay, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

/** Converts a weekly JST slot ("saturday", "23:30") into the viewer's local day and time. */
function localSlot(day: ScheduleDay, time: string) {
  const [h, m] = time.split(':').map(Number)
  // 2024-01-07 was a Sunday; any reference week works for weekday math.
  const utc = Date.UTC(2024, 0, 7 + dayIndex[day], h - 9, m)
  const date = new Date(utc)
  return {
    weekday: date.toLocaleDateString(undefined, { weekday: 'short' }),
    time: date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    }),
    sameDay: date.getDay() === dayIndex[day],
  }
}

function SchedulePage() {
  const { day, items } = Route.useLoaderData()
  const mounted = useMounted()
  const today = todayInJapan()

  const slots = new Map<string, typeof items>()
  for (const item of items) {
    const key = item.time
    slots.set(key, [...(slots.get(key) ?? []), item])
  }

  return (
    <Container className="py-10">
      <PageHeader eyebrow="Weekly" title="Airing schedule">
        <p className="mt-2 text-sm text-muted">
          Times are Japan broadcast times (JST), with your local time
          underneath.
        </p>
      </PageHeader>
      <nav
        aria-label="Day of week"
        className="no-scrollbar -mx-4 mb-8 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0"
      >
        {scheduleDays.map((d) => (
          <Link
            key={d}
            to="/schedule"
            search={{ day: d }}
            aria-current={d === day ? 'page' : undefined}
            className={`relative shrink-0 rounded-lg px-4 py-2 text-sm font-bold capitalize transition ${d === day ? 'bg-accent text-on-accent' : 'bg-surface text-muted hover:text-text'}`}
          >
            {d.slice(0, 3)}
            <span className="hidden sm:inline">{d.slice(3)}</span>
            {d === today && (
              <span className="ml-1.5 text-[10px] tracking-wider uppercase opacity-80">
                today
              </span>
            )}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <EmptyState
          title="Nothing scheduled"
          message="No shows are listed for this day yet."
        />
      ) : (
        <ol className="flex flex-col">
          {[...slots.entries()].map(([time, shows]) => {
            const local =
              time !== 'unknown' && mounted ? localSlot(day, time) : null
            return (
              <li
                key={time}
                className="grid gap-3 border-t border-line py-5 sm:grid-cols-[120px_1fr] sm:gap-6"
              >
                <div className="sm:pt-1">
                  <p className="font-mono text-xl font-semibold">
                    {time === 'unknown' ? 'TBA' : time}
                  </p>
                  <p className="font-mono text-xs text-muted">
                    {time === 'unknown' ? 'Time not announced' : 'JST'}
                    {local && (
                      <span className="block text-accent-text">
                        {local.sameDay ? '' : `${local.weekday} `}
                        {local.time} local
                      </span>
                    )}
                  </p>
                </div>
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {shows.map(({ card, episode }) => (
                    <li key={card.id}>
                      <Link
                        to="/anime/$id"
                        params={{ id: String(card.id) }}
                        className="group flex gap-3 rounded-xl border border-line bg-surface p-2.5 transition hover:border-accent"
                      >
                        <Img
                          src={card.image}
                          alt=""
                          className="h-20 w-14 shrink-0 rounded-md"
                        />
                        <div className="min-w-0 flex-1 py-0.5">
                          <p className="line-clamp-2 text-sm leading-snug font-bold group-hover:text-accent-text">
                            {displayTitle(card)}
                          </p>
                          <p className="mt-1 truncate text-xs text-muted">
                            {[
                              `Episode ${episode}${card.count ? ` of ${card.count}` : ''}`,
                              card.type,
                              card.genres[0],
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                          <ScoreBadge score={card.score} className="mt-1.5" />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            )
          })}
        </ol>
      )}
    </Container>
  )
}
