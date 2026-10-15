import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { NftUpdatedEvent, OrderUpdatedEvent } from '@/api/contracts/events'
import { mocksReady } from '@/lib/mocks-ready'
import { cacheOwner, useSession } from '@/session/session-store'
import {
  applyNftUpdated,
  applyOrderUpdated,
  forgetSeenEvents,
  isDuplicateEvent,
} from './apply-events'

// Uma conexão só para o app inteiro. Quando o usuário muda, fecha e abre de novo
// com o token novo, para nenhum evento da sessão anterior chegar no usuário atual.
export function useRealtimeSync() {
  const queryClient = useQueryClient()
  const session = useSession()
  const token = session.token
  const owner = cacheOwner(session)
  const restoring = session.restoring

  useEffect(() => {
    // Sem saber ainda quem é o usuário, não conecta com um token que pode estar vencido.
    if (restoring) return

    let active = true
    let stopListening = () => {}

    // O socket.io-client só pode carregar depois do worker do MSW: o engine.io
    // guarda o `WebSocket` global quando o módulo é importado.
    mocksReady
      .then(() => import('./socket'))
      .then(({ connectSocket, socket }) => {
        if (!active) return
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

        stopListening = () => {
          socket.off('connect', handleConnect)
          socket.off('nft.updated', handleNftUpdated)
          socket.off('order.updated', handleOrderUpdated)
          socket.disconnect()
        }
      })

    return () => {
      active = false
      stopListening()
      forgetSeenEvents()
    }
  }, [queryClient, token, owner, restoring])
}
