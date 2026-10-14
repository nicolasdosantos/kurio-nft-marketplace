import Decimal from 'decimal.js'
import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import { editionIdSchema } from '@/api/contracts/nfts'
import { ethAmountSchema } from '@/api/contracts/common'
import { findNft, getDb, resetDb, saveDb } from '../db'
import { resumePendingOrders } from '../order-logic'
import {
  emitNftUpdated,
  getSentNftEvents,
  goOffline,
  goOnline,
  sendNftEvent,
} from '../realtime/connections'
import { errorResponse, notFound, readBody } from '../responses'
import {
  addRouteFault,
  clearRouteFaults,
  getScenario,
  resetScenario,
  routeFaultSchema,
  scenarioDescriptions,
  scenarioNameSchema,
  setScenario,
} from '../scenarios'

const setScenarioSchema = z.object({
  name: scenarioNameSchema,
  seed: z.number().int().optional(),
})

const changeNftSchema = z.object({
  priceEth: ethAmountSchema.optional(),
  raiseByEth: ethAmountSchema.optional(),
  editionId: editionIdSchema.optional(),
  stock: z.number().int().min(0).optional(),
})

// Endpoints de controle da simulação: usados pelos testes e pelo painel de demonstração.
// Mudam o estado do "servidor" e disparam os eventos pelo socket, como um backend faria.
export const mockControlHandlers = [
  http.get('/api/mock-control/scenario', () => {
    return HttpResponse.json({ ...getScenario(), available: scenarioDescriptions })
  }),

  http.put('/api/mock-control/scenario', async ({ request }) => {
    const parsed = await readBody(request, setScenarioSchema)
    if (parsed.response) return parsed.response

    setScenario(parsed.body.name, parsed.body.seed)
    return HttpResponse.json(getScenario())
  }),

  http.post('/api/mock-control/faults', async ({ request }) => {
    const parsed = await readBody(request, routeFaultSchema)
    if (parsed.response) return parsed.response

    addRouteFault(parsed.body)
    return HttpResponse.json(getScenario().faults)
  }),

  http.delete('/api/mock-control/faults', () => {
    clearRouteFaults()
    return new HttpResponse(null, { status: 204 })
  }),

  http.post('/api/mock-control/reset', async () => {
    await resetDb()
    resetScenario()
    goOnline()
    resumePendingOrders()
    return new HttpResponse(null, { status: 204 })
  }),

  http.post('/api/mock-control/expire-sessions', () => {
    const db = getDb()
    for (const session of db.sessions) session.expiresAt = Date.now()
    saveDb()
    return new HttpResponse(null, { status: 204 })
  }),

  http.post('/api/mock-control/wallets/disconnect', () => {
    const db = getDb()
    for (const walletState of Object.values(db.wallets)) walletState.connected = {}
    saveDb()
    return new HttpResponse(null, { status: 204 })
  }),

  http.post('/api/mock-control/nfts/:nftId', async ({ params, request }) => {
    const nft = findNft(String(params.nftId))
    if (!nft) return notFound('NFT não encontrado.')
    const parsed = await readBody(request, changeNftSchema)
    if (parsed.response) return parsed.response
    const change = parsed.body

    if (change.priceEth) nft.priceEth = change.priceEth
    if (change.raiseByEth)
      nft.priceEth = new Decimal(nft.priceEth).plus(change.raiseByEth).toFixed()
    if (change.editionId && change.stock !== undefined) {
      nft.editions.find((edition) => edition.id === change.editionId)!.stock = change.stock
    }

    nft.version += 1
    saveDb()
    emitNftUpdated(nft)
    return HttpResponse.json(nft)
  }),

  // Reenvia um evento já emitido: o último (duplicado) ou o penúltimo (antigo).
  http.post('/api/mock-control/nfts/:nftId/replay-event', async ({ params, request }) => {
    const parsed = await readBody(request, z.object({ which: z.enum(['last', 'previous']) }))
    if (parsed.response) return parsed.response

    const events = getSentNftEvents(String(params.nftId))
    const event = parsed.body.which === 'last' ? events.at(-1) : events.at(-2)
    if (!event) {
      return errorResponse(400, 'BAD_REQUEST', 'Ainda não há eventos suficientes para reenviar.')
    }
    sendNftEvent(event)
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
]
