import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import type { Nft, NftListParams, NftListResponse } from './contracts/nfts'
import { http } from './http'
import { queryKeys } from './query-keys'

export async function fetchNftList(params: NftListParams, signal?: AbortSignal) {
  const response = await http.get<NftListResponse>('/nfts', { params, signal })
  return response.data
}

export async function fetchNft(nftId: string, signal?: AbortSignal) {
  const response = await http.get<Nft>(`/nfts/${nftId}`, { signal })
  return response.data
}

export function nftListQuery(params: NftListParams) {
  return queryOptions({
    // A chave inclui os filtros: uma resposta antiga nunca cai no lugar da busca atual,
    // e o `signal` cancela a requisição que ficou para trás.
    queryKey: queryKeys.nftList(params),
    queryFn: ({ signal }) => fetchNftList(params, signal),
    placeholderData: keepPreviousData,
  })
}

export function nftDetailQuery(nftId: string) {
  return queryOptions({
    queryKey: queryKeys.nftDetail(nftId),
    queryFn: ({ signal }) => fetchNft(nftId, signal),
  })
}

export function useNftList(params: NftListParams) {
  return useQuery(nftListQuery(params))
}

export function useNft(nftId: string) {
  return useQuery(nftDetailQuery(nftId))
}
