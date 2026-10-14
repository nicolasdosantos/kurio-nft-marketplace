import Decimal from 'decimal.js'
import type { Nft, NftUpdatedEvent } from '@/api/types'
import { nftFixtures } from './fixtures/nfts'

// Banco em memória do "servidor" simulado. Por enquanto só NFTs;
// carrinho, usuários, pedidos etc. entram aqui nas próximas fases.
let nfts: Nft[] = structuredClone(nftFixtures)
let sentNftEvents: NftUpdatedEvent[] = []

export function findNft(id: string) {
  return nfts.find((nft) => nft.id === id)
}

export function raiseNftPrice(id: string, amountEth: string) {
  const nft = findNft(id)
  if (!nft) return undefined

  nft.priceEth = new Decimal(nft.priceEth).plus(amountEth).toFixed(2)
  nft.version += 1

  const event: NftUpdatedEvent = {
    eventId: crypto.randomUUID(),
    type: 'nft.updated',
    resourceId: nft.id,
    version: nft.version,
    occurredAt: new Date().toISOString(),
    changes: { priceEth: nft.priceEth, editionsAvailable: nft.editionsAvailable },
  }
  sentNftEvents.push(event)
  return event
}

export function getSentNftEvents(nftId: string) {
  return sentNftEvents.filter((event) => event.resourceId === nftId)
}

export function resetDb() {
  nfts = structuredClone(nftFixtures)
  sentNftEvents = []
}
