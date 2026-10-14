import { QueryClient } from '@tanstack/react-query'
import { isRetryableError, type ApiRequestError } from '@/api/errors'

// O interceptor do Axios já converte todo erro para ApiRequestError.
declare module '@tanstack/react-query' {
  interface Register {
    defaultError: ApiRequestError
  }
}

const MAX_READ_RETRIES = 2

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // 4xx não muda tentando de novo; rede e 5xx podem ser passageiros.
      retry: (failureCount, error) => failureCount < MAX_READ_RETRIES && isRetryableError(error),
      retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4000),
    },
    mutations: {
      // Repetir escrita sozinho pode duplicar operação. Só o pedido repete (com idempotência).
      retry: false,
    },
  },
})
