import { useState } from 'react'
import { imageUrl } from '#/lib/images'
import { Link, useRouter } from '@tanstack/react-router'
import {
  ChevronLeft,
  ChevronRight,
  ImageOff,
  RotateCw,
  Star,
} from 'lucide-react'
import type { ReactNode } from 'react'

export const btn = {
  primary:
    'inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-on-accent transition hover:brightness-105 active:translate-y-px disabled:opacity-60',
  ghost:
    'inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-text transition hover:border-muted hover:bg-raised disabled:opacity-60',
  icon: 'inline-flex size-9 items-center justify-center rounded-lg border border-line bg-surface text-text transition hover:border-muted hover:bg-raised disabled:opacity-40',
}

export const field =
  'w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-text placeholder:text-muted transition focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

/** Lazy-loaded image with a quiet fallback when the URL is missing or broken. */
export function Img({
  src,
  alt,
  className = '',
  eager = false,
  sizes,
  srcSet,
}: {
  src: string | null | undefined
  alt: string
  className?: string
  eager?: boolean
  sizes?: string
  srcSet?: string
}) {
  const [failed, setFailed] = useState<string | null>(null)
  const [original, setOriginal] = useState<string | null>(null)
  const useOriginal = original === src
  if (!src || failed === src) {
    return (
      <div
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        className={`flex items-center justify-center bg-raised text-muted ${className}`}
      >
        <ImageOff className="size-6" aria-hidden />
      </div>
    )
  }
  return (
    <img
      src={useOriginal ? src : imageUrl(src)}
      srcSet={
        useOriginal
          ? undefined
          : srcSet
            ? srcSet
                .split(', ')
                .map((entry) => {
                  const [url, size] = entry.split(' ')
                  return `${imageUrl(url, Number.parseInt(size))} ${size}`
                })
                .join(', ')
            : imageUrl(src) !== src
              ? `${imageUrl(src, 225)} 225w, ${imageUrl(src, 450)} 450w, ${imageUrl(src, 960)} 960w`
              : undefined
      }
      sizes={sizes ?? '320px'}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={eager ? 'high' : undefined}
      referrerPolicy="no-referrer"
      onError={() => {
        if (!useOriginal && imageUrl(src) !== src) setOriginal(src)
        else setFailed(src)
      }}
      className={`bg-raised object-cover ${className}`}
    />
  )
}

export function ScoreBadge({
  score,
  className = '',
}: {
  score: number | null
  className?: string
}) {
  if (!score) return null
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md bg-accent px-1.5 py-0.5 font-mono text-xs font-semibold text-on-accent ${className}`}
    >
      <Star className="size-3 fill-current" aria-hidden />
      <span className="sr-only">Score </span>
      {score.toFixed(1)}
    </span>
  )
}

export function SectionHeading({
  title,
  action,
  id,
}: {
  title: string
  action?: ReactNode
  id?: string
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <h2 id={id} className="text-xl font-extrabold tracking-tight sm:text-2xl">
        {title}
      </h2>
      {action}
    </div>
  )
}

export function PageHeader({
  title,
  eyebrow,
  children,
}: {
  title: string
  eyebrow?: string
  children?: ReactNode
}) {
  return (
    <header className="mb-8">
      {eyebrow && (
        <p className="mb-2 font-mono text-xs tracking-widest text-accent-text uppercase">
          {eyebrow}
        </p>
      )}
      <h1 className="font-display text-3xl leading-tight sm:text-4xl">
        {title}
      </h1>
      {children}
    </header>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  retry = true,
}: {
  title?: string
  message?: string
  retry?: boolean
}) {
  const router = useRouter()
  return (
    <div
      role="alert"
      className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-14 text-center"
    >
      <p className="text-lg font-bold">{title}</p>
      {message && <p className="mt-2 max-w-md text-sm text-muted">{message}</p>}
      {retry && (
        <button
          type="button"
          className={`${btn.ghost} mt-5`}
          onClick={() => router.invalidate()}
        >
          <RotateCw className="size-4" aria-hidden /> Try again
        </button>
      )}
    </div>
  )
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string
  message?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-14 text-center">
      <p className="text-lg font-bold">{title}</p>
      {message && <p className="mt-2 max-w-md text-sm text-muted">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function PosterSkeleton() {
  return (
    <div aria-hidden>
      <div className="skeleton aspect-[2/3] rounded-xl" />
      <div className="skeleton mt-3 h-4 w-4/5 rounded" />
      <div className="skeleton mt-2 h-3 w-1/2 rounded" />
    </div>
  )
}

export function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
      role="status"
      aria-label="Loading"
    >
      {Array.from({ length: count }, (_, i) => (
        <PosterSkeleton key={i} />
      ))}
    </div>
  )
}

export function RowSkeleton() {
  return (
    <div
      className="flex gap-4 overflow-hidden"
      role="status"
      aria-label="Loading"
    >
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} className="w-36 shrink-0 sm:w-44">
          <PosterSkeleton />
        </div>
      ))}
    </div>
  )
}

export function Pagination({
  page,
  lastPage,
  hasNext,
  to,
  search,
}: {
  page: number
  lastPage: number
  hasNext: boolean
  to: string
  search: (page: number) => Record<string, unknown>
}) {
  if (lastPage <= 1 && !hasNext) return null
  const linkCls = `${btn.ghost} px-3`
  return (
    <nav
      aria-label="Pagination"
      className="mt-10 flex items-center justify-center gap-3"
    >
      {page > 1 ? (
        <Link to={to} search={search(page - 1) as never} className={linkCls}>
          <ChevronLeft className="size-4" aria-hidden /> Previous
        </Link>
      ) : (
        <span
          className={`${linkCls} pointer-events-none opacity-40`}
          aria-disabled
        >
          <ChevronLeft className="size-4" aria-hidden /> Previous
        </span>
      )}
      <span className="font-mono text-sm text-muted">
        Page {page} of {lastPage}
      </span>
      {hasNext ? (
        <Link to={to} search={search(page + 1) as never} className={linkCls}>
          Next <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : (
        <span
          className={`${linkCls} pointer-events-none opacity-40`}
          aria-disabled
        >
          Next <ChevronRight className="size-4" aria-hidden />
        </span>
      )}
    </nav>
  )
}

export function Container({
  children,
  className = '',
  narrow = false,
}: {
  children: ReactNode
  className?: string
  narrow?: boolean
}) {
  return (
    <div
      className={`mx-auto w-full px-4 sm:px-6 lg:px-8 ${narrow ? 'max-w-3xl' : 'max-w-7xl'} ${className}`}
    >
      {children}
    </div>
  )
}

export function formatNumber(n: number | null | undefined) {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('en', {
    notation: n >= 10_000 ? 'compact' : 'standard',
  }).format(n)
}
