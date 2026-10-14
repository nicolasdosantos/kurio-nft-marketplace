import { queryOptions } from '@tanstack/react-query'
import { http } from './http'
import type { Nft, NftUpdatedEvent } from './types'

export const nftKeys = {
  all: ['nfts'] as const,
  detail: (nftId: string) => ['nfts', 'detail', nftId] as const,
}

export async function fetchNft(nftId: string, signal?: AbortSignal) {
  const response = await http.get<Nft>(`/nfts/${nftId}`, { signal })
  return response.data
}

export function nftDetailQuery(nftId: string) {
  return queryOptions({
    queryKey: nftKeys.detail(nftId),
    queryFn: ({ signal }) => fetchNft(nftId, signal),
  })
}

// Só existem para a página da PoC: controlam o "servidor" simulado.
export async function raiseNftPriceOnServer(nftId: string) {
  const response = await http.post<NftUpdatedEvent>(`/mock-control/nfts/${nftId}/raise-price`)
  return response.data
}

export async function replayNftEvent(nftId: string, which: 'last' | 'previous') {
  await http.post(`/mock-control/nfts/${nftId}/replay-event`, { which })
}

export async function setRealtimeOnline(online: boolean) {
  await http.post(`/mock-control/realtime/${online ? 'online' : 'offline'}`)
}
