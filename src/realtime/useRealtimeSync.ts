import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { nftKeys } from '@/api/nfts'
import type { NftUpdatedEvent } from '@/api/contracts/events'
import { applyNftUpdated } from './nft-updates'
import { socket } from './socket'

export function useRealtimeSync() {
  const queryClient = useQueryClient()

  useEffect(() => {
    let connectedBefore = false

    function handleConnect() {
      // Eventos perdidos enquanto estava desconectado: busca de novo via REST.
      if (connectedBefore) {
        queryClient.invalidateQueries({ queryKey: nftKeys.all })
      }
      connectedBefore = true
    }

    function handleNftUpdated(event: NftUpdatedEvent) {
      applyNftUpdated(queryClient, event)
    }

    socket.on('connect', handleConnect)
    socket.on('nft.updated', handleNftUpdated)
    socket.connect()

    return () => {
      socket.off('connect', handleConnect)
      socket.off('nft.updated', handleNftUpdated)
      socket.disconnect()
    }
  }, [queryClient])
}
