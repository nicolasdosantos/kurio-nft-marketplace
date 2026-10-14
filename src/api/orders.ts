import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cacheOwner, useSession } from '@/session/session-store'
import type { CreateOrderRequest, Order } from './contracts/orders'
import { isRetryableError } from './errors'
import { http } from './http'
import { queryKeys } from './query-keys'

const PENDING_REFETCH_MS = 3000

export function useOrders() {
  const session = useSession()
  return useQuery({
    queryKey: queryKeys.orders(cacheOwner(session)),
    queryFn: async ({ signal }) => {
      const response = await http.get<Order[]>('/orders', { signal })
      return response.data
    },
    enabled: session.user !== null,
  })
}

export function useOrder(orderId: string) {
  const session = useSession()
  return useQuery({
    queryKey: queryKeys.order(cacheOwner(session), orderId),
    queryFn: async ({ signal }) => {
      const response = await http.get<Order>(`/orders/${orderId}`, { signal })
      return response.data
    },
    enabled: session.user !== null,
    // O order.updated chega pelo socket; isso só cobre o caso de o evento se perder.
    refetchInterval: (query) =>
      query.state.data?.status === 'pending' ? PENDING_REFETCH_MS : false,
  })
}

export interface CreateOrderVariables {
  order: CreateOrderRequest
  // Gerada uma vez por tentativa de compra: os retries reaproveitam a mesma chave.
  idempotencyKey: string
}

export function useCreateOrder() {
  const queryClient = useQueryClient()
  const owner = cacheOwner(useSession())

  return useMutation({
    mutationFn: async ({ order, idempotencyKey }: CreateOrderVariables) => {
      const response = await http.post<Order>('/orders', order, {
        headers: { 'Idempotency-Key': idempotencyKey },
      })
      return response.data
    },
    // Única mutation que repete sozinha: com a mesma chave o servidor devolve o mesmo pedido.
    retry: (failureCount, error) => failureCount < 3 && isRetryableError(error),
    retryDelay: 1000,
    onSuccess: (order) => {
      queryClient.setQueryData(queryKeys.order(owner, order.id), order)
      queryClient.invalidateQueries({ queryKey: queryKeys.orders(owner) })
    },
  })
}
