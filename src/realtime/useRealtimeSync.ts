import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { NftUpdatedEvent, OrderUpdatedEvent } from '@/api/contracts/events'
import { cacheOwner, useSession } from '@/session/session-store'
import {
  applyNftUpdated,
  applyOrderUpdated,
  forgetSeenEvents,
  isDuplicateEvent,
} from './apply-events'
import { connectSocket, socket } from './socket'

// Uma conexão só para o app inteiro. Quando o usuário muda, fecha e abre de novo
// com o token novo, para nenhum evento da sessão anterior chegar no usuário atual.
export function useRealtimeSync() {
  const queryClient = useQueryClient()
  const session = useSession()
  const token = session.token
  const owner = cacheOwner(session)

  useEffect(() => {
    let connectedBefore = false

    function handleConnect() {
      // Eventos perdidos enquanto estava fora: revalida via REST o que está na tela.
      if (connectedBefore) {
        queryClient.invalidateQueries({ refetchType: 'active' })
      }
      connectedBefore = true
    }

    function handleNftUpdated(event: NftUpdatedEvent) {
      if (isDuplicateEvent(event.eventId)) return
      applyNftUpdated(queryClient, owner, event)
    }

    function handleOrderUpdated(event: OrderUpdatedEvent) {
      if (isDuplicateEvent(event.eventId)) return
      applyOrderUpdated(queryClient, owner, event)
    }

    socket.on('connect', handleConnect)
    socket.on('nft.updated', handleNftUpdated)
    socket.on('order.updated', handleOrderUpdated)
    connectSocket(token)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('nft.updated', handleNftUpdated)
      socket.off('order.updated', handleOrderUpdated)
      socket.disconnect()
      forgetSeenEvents()
    }
  }, [queryClient, token, owner])
}
