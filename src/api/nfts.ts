import { queryOptions } from '@tanstack/react-query'
import type { Nft } from './contracts/nfts'
import { http } from './http'

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
