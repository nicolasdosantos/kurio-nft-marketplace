import { QueryClient } from '@tanstack/react-query'

// Cache/retry policy is provisional; it will be finalized and documented in ARCHITECTURE.md.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})
