import type { QueryClient } from '@tanstack/react-query'
import type { NftUpdatedEvent } from '@/api/contracts/events'
import type { Nft } from '@/api/contracts/nfts'
import { nftKeys } from '@/api/nfts'

export type NftEventOutcome = 'applied' | 'ignored-stale' | 'ignored-not-cached'

export interface NftEventLogEntry {
  event: NftUpdatedEvent
  outcome: NftEventOutcome
}

const logListeners = new Set<(entry: NftEventLogEntry) => void>()

export function onNftEventProcessed(listener: (entry: NftEventLogEntry) => void) {
  logListeners.add(listener)
  return () => {
    logListeners.delete(listener)
  }
}

export function applyNftUpdated(queryClient: QueryClient, event: NftUpdatedEvent) {
  const nftId = event.resource.id
  const cachedNft = queryClient.getQueryData<Nft>(nftKeys.detail(nftId))

  let outcome: NftEventOutcome
  if (!cachedNft) {
    outcome = 'ignored-not-cached'
  } else if (event.version <= cachedNft.version) {
    // Duplicado ou fora de ordem: nunca regredir para um estado mais antigo.
    outcome = 'ignored-stale'
  } else {
    queryClient.setQueryData<Nft>(nftKeys.detail(nftId), {
      ...cachedNft,
      priceEth: event.data.priceEth,
      originalPriceEth: event.data.originalPriceEth,
      editions: cachedNft.editions.map((edition) => ({
        ...edition,
        stock: event.data.editions.find((item) => item.id === edition.id)?.stock ?? edition.stock,
      })),
      version: event.version,
    })
    outcome = 'applied'
  }

  for (const listener of logListeners) {
    listener({ event, outcome })
  }
}
