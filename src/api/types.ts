// Contratos compartilhados entre o app e os mocks.

export type Network = 'ethereum' | 'polygon' | 'solana'

export interface Nft {
  id: string
  name: string
  collection: string
  network: Network
  // Valores em ETH sempre como string decimal, nunca number.
  priceEth: string
  originalPriceEth: string | null
  editionsAvailable: number
  version: number
}

export interface ApiError {
  code: 'NOT_FOUND' | 'VALIDATION' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'CONFLICT' | 'UNAVAILABLE'
  message: string
}

export interface NftUpdatedEvent {
  eventId: string
  type: 'nft.updated'
  resourceId: string
  version: number
  occurredAt: string
  changes: Pick<Nft, 'priceEth' | 'editionsAvailable'>
}
