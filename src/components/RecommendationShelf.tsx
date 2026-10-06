import { Link } from '@tanstack/react-router'
import { Shelf, detailLink } from './media'
import { Img, ScoreBadge, formatNumber } from './ui'
import type { Recommendation } from '#/lib/media'

/** AniList recommendations already carry full card data, so nothing else to fetch. */
export function RecommendationShelf({ items }: { items: Recommendation[] }) {
  return (
    <Shelf label="Recommendations">
      {items.map((item) => (
        <li key={`${item.kind}-${item.id}`} className="w-64 shrink-0 snap-start">
          <Link {...detailLink(item.kind, item.id)} className="flex gap-3 rounded-lg bg-surface p-3 hover:bg-raised">
            <div className="relative shrink-0">
              <Img src={item.image} alt="" className="h-28 w-20 rounded-md" />
              <ScoreBadge score={item.score} className="absolute top-1 right-1" />
            </div>
            <div className="min-w-0">
              <h3 className="line-clamp-3 text-sm font-bold">{item.titleEnglish || item.title}</h3>
              <p className="mt-2 text-xs text-muted">
                {[item.type, item.year, item.count ? `${item.count} ${item.kind === 'anime' ? 'eps' : 'ch'}` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {item.votes > 0 && (
                <p className="mt-1 text-xs text-muted">
                  Recommended by {formatNumber(item.votes)} AniList {item.votes === 1 ? 'user' : 'users'}
                </p>
              )}
              {item.genres.length > 0 && <p className="mt-1 truncate text-xs text-muted">{item.genres.slice(0, 2).join(' · ')}</p>}
            </div>
          </Link>
        </li>
      ))}
    </Shelf>
  )
}
