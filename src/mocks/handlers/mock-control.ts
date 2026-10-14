import { http, HttpResponse } from 'msw'
import type { ApiError } from '@/api/types'
import { getSentNftEvents, raiseNftPrice, resetDb } from '../db'
import { emitNftUpdated, goOffline, goOnline } from '../realtime/connections'

// Endpoints de controle da simulação: mudam o estado do "servidor" e disparam
// os eventos pelo socket, como um backend de verdade faria.
export const mockControlHandlers = [
  http.post('/api/mock-control/nfts/:nftId/raise-price', ({ params }) => {
    const event = raiseNftPrice(String(params.nftId), '0.10')
    if (!event) {
      return HttpResponse.json<ApiError>(
        { code: 'NOT_FOUND', message: 'NFT não encontrado.' },
        { status: 404 },
      )
    }
    emitNftUpdated(event)
    return HttpResponse.json(event)
  }),

  // Reenvia um evento já emitido: o último (duplicado) ou o penúltimo (antigo).
  http.post('/api/mock-control/nfts/:nftId/replay-event', async ({ params, request }) => {
    const { which } = (await request.json()) as { which: 'last' | 'previous' }
    const events = getSentNftEvents(String(params.nftId))
    const event = which === 'last' ? events.at(-1) : events.at(-2)

    if (!event) {
      return HttpResponse.json<ApiError>(
        { code: 'CONFLICT', message: 'Ainda não há eventos suficientes para reenviar.' },
        { status: 409 },
      )
    }
    emitNftUpdated(event)
    return HttpResponse.json(event)
  }),

  http.post('/api/mock-control/realtime/offline', () => {
    goOffline()
    return new HttpResponse(null, { status: 204 })
  }),

  http.post('/api/mock-control/realtime/online', () => {
    goOnline()
    return new HttpResponse(null, { status: 204 })
  }),

  http.post('/api/mock-control/reset', () => {
    resetDb()
    goOnline()
    return new HttpResponse(null, { status: 204 })
  }),
]
