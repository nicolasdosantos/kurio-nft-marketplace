import { useSyncExternalStore } from 'react'

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (listener) => {
      const mediaQuery = window.matchMedia(query)
      mediaQuery.addEventListener('change', listener)
      return () => mediaQuery.removeEventListener('change', listener)
    },
    () => window.matchMedia(query).matches,
  )
}

export function useIsDesktop() {
  return useMediaQuery('(min-width: 1024px)')
}
