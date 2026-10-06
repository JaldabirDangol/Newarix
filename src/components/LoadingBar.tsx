import { useRouterState } from '@tanstack/react-router'

/** Thin progress bar at the top of the page during route loads. */
export function LoadingBar() {
  const loading = useRouterState({ select: (s) => s.status === 'pending' })
  if (!loading) return null
  return (
    <div
      aria-hidden
      className="loading-bar pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-accent"
    />
  )
}
