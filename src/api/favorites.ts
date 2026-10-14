import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cacheOwner, useSession } from '@/session/session-store'
import type { FavoritesResponse } from './contracts/nfts'
import { http } from './http'
import { queryKeys } from './query-keys'

export function useFavorites() {
  const session = useSession()
  const owner = cacheOwner(session)

  return useQuery({
    queryKey: queryKeys.favorites(owner),
    queryFn: async ({ signal }) => {
      const response = await http.get<FavoritesResponse>('/favorites', { signal })
      return response.data
    },
    enabled: session.user !== null,
  })
}

// Atualização otimista: o coração muda na hora e volta se a API falhar.
export function useToggleFavorite() {
  const queryClient = useQueryClient()
  const owner = cacheOwner(useSession())
  const favoritesKey = queryKeys.favorites(owner)

  return useMutation({
    mutationFn: async ({ nftId, favorite }: { nftId: string; favorite: boolean }) => {
      if (favorite) await http.put(`/favorites/${nftId}`)
      else await http.delete(`/favorites/${nftId}`)
    },
    onMutate: async ({ nftId, favorite }) => {
      await queryClient.cancelQueries({ queryKey: favoritesKey })
      const previousFavorites = queryClient.getQueryData<FavoritesResponse>(favoritesKey)

      queryClient.setQueryData<FavoritesResponse>(favoritesKey, (current) => {
        const nftIds = current?.nftIds ?? []
        return {
          nftIds: favorite ? [...nftIds, nftId] : nftIds.filter((id) => id !== nftId),
        }
      })
      return { previousFavorites }
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(favoritesKey, context?.previousFavorites)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: favoritesKey }),
  })
}
