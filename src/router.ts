import { useSyncExternalStore } from 'react'

// Hash routing: GitHub Pages no tiene fallback de SPA, así que las rutas viven en el hash (#/sheet).
export const ROUTES = ['sheet', 'play', 'level-up'] as const
export type Route = (typeof ROUTES)[number]

const DEFAULT_ROUTE: Route = 'sheet'

function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '')
  return (ROUTES as readonly string[]).includes(path) ? (path as Route) : DEFAULT_ROUTE
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, () => parseHash(window.location.hash))
}

export function href(route: Route): string {
  return `#/${route}`
}
