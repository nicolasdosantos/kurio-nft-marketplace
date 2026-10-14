import type { QueryClient } from '@tanstack/react-query'
import { nftKeys } from '@/api/nfts'
import type { Nft, NftUpdatedEvent } from '@/api/types'

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
  const cachedNft = queryClient.getQueryData<Nft>(nftKeys.detail(event.resourceId))

  let outcome: NftEventOutcome
  if (!cachedNft) {
    outcome = 'ignored-not-cached'
  } else if (event.version <= cachedNft.version) {
    // Duplicado ou fora de ordem: nunca regredir para um estado mais antigo.
    outcome = 'ignored-stale'
  } else {
    queryClient.setQueryData<Nft>(nftKeys.detail(event.resourceId), {
      ...cachedNft,
      ...event.changes,
      version: event.version,
    })
    outcome = 'applied'
  }

  for (const listener of logListeners) {
    listener({ event, outcome })
  }
}
