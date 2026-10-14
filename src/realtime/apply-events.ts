import type { QueryClient } from '@tanstack/react-query'
import type { Cart } from '@/api/contracts/cart'
import type { NftUpdatedEvent, OrderUpdatedEvent } from '@/api/contracts/events'
import type { Nft, NftListResponse } from '@/api/contracts/nfts'
import type { Order } from '@/api/contracts/orders'
import { queryKeys } from '@/api/query-keys'
import { announce } from './announcements'

const MAX_REMEMBERED_EVENTS = 500
const seenEventIds = new Set<string>()

// O mesmo evento pode chegar duas vezes (reenvio, reconexão): aplica só a primeira.
export function isDuplicateEvent(eventId: string) {
  if (seenEventIds.has(eventId)) return true
  seenEventIds.add(eventId)
  if (seenEventIds.size > MAX_REMEMBERED_EVENTS) {
    const oldest = seenEventIds.values().next().value
    if (oldest) seenEventIds.delete(oldest)
  }
  return false
}

export function forgetSeenEvents() {
  seenEventIds.clear()
}

export function applyNftUpdated(queryClient: QueryClient, owner: string, event: NftUpdatedEvent) {
  const nftId = event.resource.id
  const isNewer = (version: number) => event.version > version

  queryClient.setQueryData<Nft>(queryKeys.nftDetail(nftId), (cachedNft) => {
    if (!cachedNft || !isNewer(cachedNft.version)) return cachedNft
    return {
      ...cachedNft,
      priceEth: event.data.priceEth,
      originalPriceEth: event.data.originalPriceEth,
      version: event.version,
      editions: cachedNft.editions.map((edition) => ({
        ...edition,
        stock: event.data.editions.find((item) => item.id === edition.id)?.stock ?? edition.stock,
      })),
    }
  })

  queryClient.setQueriesData<NftListResponse>({ queryKey: ['nfts', 'list'] }, (page) => {
    if (!page) return page
    return {
      ...page,
      items: page.items.map((nft) =>
        nft.id === nftId && isNewer(nft.version)
          ? {
              ...nft,
              priceEth: event.data.priceEth,
              originalPriceEth: event.data.originalPriceEth,
              version: event.version,
            }
          : nft,
      ),
    }
  })

  const cart = queryClient.getQueryData<Cart>(queryKeys.cart(owner))
  const cartItem = cart?.items.find((item) => item.nftId === nftId)
  if (cartItem) {
    // Preço e estoque do carrinho vêm do servidor: busca de novo em vez de calcular aqui.
    queryClient.invalidateQueries({ queryKey: queryKeys.cart(owner) })
    queryClient.invalidateQueries({ queryKey: ['owner', owner, 'quote'] })
    if (cartItem.unitPriceEth !== event.data.priceEth) {
      announce(`O preço de ${cartItem.name} mudou para ${event.data.priceEth} ETH.`)
    }
  }
}

export function applyOrderUpdated(
  queryClient: QueryClient,
  owner: string,
  event: OrderUpdatedEvent,
) {
  const orderKey = queryKeys.order(owner, event.resource.id)
  const cachedOrder = queryClient.getQueryData<Order>(orderKey)
  if (cachedOrder && event.version <= cachedOrder.version) return

  if (cachedOrder) {
    queryClient.setQueryData<Order>(orderKey, {
      ...cachedOrder,
      status: event.data.status,
      failureReason: event.data.failureReason,
      version: event.version,
    })
  }
  // O recibo completo (data de confirmação etc.) vem do REST.
  queryClient.invalidateQueries({ queryKey: orderKey })
  queryClient.invalidateQueries({ queryKey: queryKeys.orders(owner), exact: true })

  if (event.data.status === 'confirmed') {
    queryClient.invalidateQueries({ queryKey: queryKeys.cart(owner) })
    queryClient.invalidateQueries({ queryKey: queryKeys.nfts })
    announce('Pagamento confirmado. Seus NFTs já estão na sua carteira.')
  } else if (event.data.status === 'declined') {
    announce('O pagamento foi recusado. Seus itens continuam no carrinho.')
  }
}
