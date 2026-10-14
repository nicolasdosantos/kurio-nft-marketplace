import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cacheOwner, useSession } from '@/session/session-store'
import type { AddCartItemRequest, Cart, Quote } from './contracts/cart'
import type { Network } from './contracts/common'
import { http } from './http'
import { queryKeys } from './query-keys'

function useCartOwner() {
  return cacheOwner(useSession())
}

export function useCart() {
  const owner = useCartOwner()
  return useQuery({
    queryKey: queryKeys.cart(owner),
    queryFn: async ({ signal }) => {
      const response = await http.get<Cart>('/cart', { signal })
      return response.data
    },
  })
}

export function useQuote(network: Network, enabled = true) {
  const owner = useCartOwner()
  return useQuery({
    queryKey: queryKeys.quote(owner, network),
    queryFn: async () => {
      const response = await http.post<Quote>('/quote', { network })
      return response.data
    },
    enabled,
    // A cotação muda com o carrinho, então nunca vale reaproveitar uma antiga.
    staleTime: 0,
  })
}

// Toda mudança no carrinho devolve o carrinho novo; a cotação fica velha.
function useCartMutation<Variables>(request: (variables: Variables) => Promise<Cart>) {
  const queryClient = useQueryClient()
  const owner = useCartOwner()

  return useMutation({
    mutationFn: request,
    onSuccess: (cart) => {
      queryClient.setQueryData(queryKeys.cart(owner), cart)
      queryClient.invalidateQueries({ queryKey: ['owner', owner, 'quote'] })
    },
  })
}

export function useAddToCart() {
  return useCartMutation(async (item: AddCartItemRequest) => {
    const response = await http.post<Cart>('/cart/items', item)
    return response.data
  })
}

export function useUpdateCartItem() {
  return useCartMutation(async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
    const response = await http.patch<Cart>(`/cart/items/${itemId}`, { quantity })
    return response.data
  })
}

export function useRemoveCartItem() {
  return useCartMutation(async (itemId: string) => {
    const response = await http.delete<Cart>(`/cart/items/${itemId}`)
    return response.data
  })
}

export function useApplyCoupon() {
  return useCartMutation(async (code: string) => {
    const response = await http.put<Cart>('/cart/coupon', { code })
    return response.data
  })
}

export function useRemoveCoupon() {
  return useCartMutation(async () => {
    const response = await http.delete<Cart>('/cart/coupon')
    return response.data
  })
}
