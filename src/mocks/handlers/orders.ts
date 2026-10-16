import Decimal from 'decimal.js'
import { http, HttpResponse } from 'msw'
import { createOrderRequestSchema } from '@/api/contracts/orders'
import {
  buildQuote,
  getCart,
  quotesMatch,
  saveQuote,
  toPublicQuote,
  userCartKey,
} from '../cart-logic'
import { findNft, getDb, saveDb, type StoredOrder } from '../db'
import {
  PAYMENT_PROCESSING_MS,
  SETTLE_ON_DEMAND,
  scheduleSettlement,
  settleOrderIfDue,
  toPublicOrder,
} from '../order-logic'
import { emitNftUpdated } from '../realtime/connections'
import { errorResponse, notFound, readBody, requireUser } from '../responses'
import { consumeCheckoutTrap, getScenario } from '../scenarios'

function randomHex(length: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(length / 2))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

// Cenários que mudam o catálogo bem na hora de confirmar a compra.
function springCheckoutTrap(cartKey: string) {
  const scenario = getScenario().name
  if (scenario !== 'price-changed-at-checkout' && scenario !== 'edition-sold-out-at-checkout') {
    return
  }

  const firstItem = getCart(cartKey).items[0]
  if (!firstItem || !consumeCheckoutTrap()) return

  const nft = findNft(firstItem.nftId)!
  if (scenario === 'price-changed-at-checkout') {
    nft.priceEth = new Decimal(nft.priceEth).plus('0.10').toFixed()
  } else {
    nft.editions.find((edition) => edition.id === firstItem.editionId)!.stock = 0
  }
  nft.version += 1
  saveDb()
  emitNftUpdated(nft)
}

export const orderHandlers = [
  http.post('/api/orders', async ({ request }) => {
    const auth = requireUser(request)
    if (auth.response) return auth.response

    const idempotencyKey = request.headers.get('Idempotency-Key')
    if (!idempotencyKey) {
      return errorResponse(400, 'BAD_REQUEST', 'Informe o header Idempotency-Key.')
    }

    const parsed = await readBody(request, createOrderRequestSchema)
    if (parsed.response) return parsed.response
    const orderRequest = parsed.body

    const db = getDb()
    const userId = auth.user.id
    const fingerprint = JSON.stringify(orderRequest)

    // Mesma chave = mesma tentativa. Devolve o pedido já criado, sem duplicar.
    const existing = db.orders.find(
      (order) => order.userId === userId && order.idempotencyKey === idempotencyKey,
    )
    if (existing) {
      if (existing.requestFingerprint !== fingerprint) {
        return errorResponse(
          409,
          'IDEMPOTENCY_CONFLICT',
          'Esta chave de idempotência já foi usada com outro conteúdo.',
        )
      }
      settleOrderIfDue(existing)
      return HttpResponse.json(toPublicOrder(existing))
    }

    const cartKey = userCartKey(userId)
    springCheckoutTrap(cartKey)

    const savedQuote = db.quotes.find(
      (quote) => quote.id === orderRequest.quoteId && quote.cartKey === cartKey,
    )
    const freshQuote = buildQuote(cartKey, orderRequest.network)
    const quoteExpired = !savedQuote || Date.parse(savedQuote.expiresAt) <= Date.now()

    if (quoteExpired || !quotesMatch(savedQuote, freshQuote)) {
      saveQuote(freshQuote)
      saveDb()
      return errorResponse(
        409,
        'QUOTE_OUTDATED',
        'Preço, estoque ou taxas mudaram. Revise o pedido antes de confirmar.',
        { details: { quote: toPublicQuote(freshQuote) } },
      )
    }
    if (!freshQuote.valid) {
      return errorResponse(409, 'OUT_OF_STOCK', 'Algum item não tem mais estoque suficiente.', {
        details: { quote: toPublicQuote(freshQuote) },
      })
    }

    const walletState = db.wallets[userId]
    const wallet = walletState?.[orderRequest.walletSlot]
    if (!wallet) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Cadastre uma carteira antes de comprar.', {
        fields: { walletSlot: 'Cadastre esta carteira antes de usar.' },
      })
    }
    const scenario = getScenario().name
    if (scenario === 'wallet-disconnects') {
      delete walletState.connected[orderRequest.walletSlot]
      saveDb()
    }
    if (walletState.connected[orderRequest.walletSlot] !== orderRequest.network) {
      return errorResponse(409, 'WALLET_DISCONNECTED', 'Conecte a carteira na rede escolhida.')
    }

    const now = Date.now()
    const order: StoredOrder = {
      id: `order-${crypto.randomUUID()}`,
      userId,
      idempotencyKey,
      requestFingerprint: fingerprint,
      plannedOutcome: scenario === 'payment-declined' ? 'declined' : 'confirmed',
      settleAt: scenario === 'payment-pending' ? SETTLE_ON_DEMAND : now + PAYMENT_PROCESSING_MS,
      status: 'pending',
      version: 1,
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
      failureReason: null,
      // Snapshot: o recibo guarda os valores da cotação e nunca mais muda.
      receipt: {
        transactionHash: `0x${randomHex(64)}`,
        simulated: true,
        confirmedAt: null,
        network: orderRequest.network,
        wallet: { type: wallet.walletType, address: wallet.address },
        items: freshQuote.lines.map((line) => {
          const nft = findNft(line.nftId)!
          const edition = nft.editions.find((item) => item.id === line.editionId)!
          return {
            nftId: nft.id,
            name: nft.name,
            tokenId: nft.tokenId,
            imageUrl: nft.imageUrl,
            editionId: edition.id,
            editionLabel: edition.label,
            quantity: line.quantity,
            unitPriceEth: line.unitPriceEth,
            lineTotalEth: line.lineTotalEth,
          }
        }),
        couponCode: freshQuote.coupon?.code ?? null,
        subtotalEth: freshQuote.subtotalEth,
        discountEth: freshQuote.discountEth,
        networkFeeEth: freshQuote.networkFeeEth,
        totalEth: freshQuote.totalEth,
      },
    }
    db.orders.push(order)
    saveDb()
    scheduleSettlement(order)

    // O pedido foi criado, mas a resposta "se perde" na rede. O retry com a
    // mesma chave encontra o pedido acima, no bloco de idempotência.
    if (scenario === 'order-timeout' && consumeCheckoutTrap()) {
      return HttpResponse.error()
    }

    return HttpResponse.json(toPublicOrder(order), { status: 201 })
  }),

  http.get('/api/orders', ({ request }) => {
    const auth = requireUser(request)
    if (auth.response) return auth.response

    const status = new URL(request.url).searchParams.get('status')
    const orders = getDb().orders.filter((order) => order.userId === auth.user.id)
    orders.forEach(settleOrderIfDue)

    return HttpResponse.json(
      orders
        .filter((order) => !status || order.status === status)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(toPublicOrder),
    )
  }),

  http.get('/api/orders/:orderId', ({ request, params }) => {
    const auth = requireUser(request)
    if (auth.response) return auth.response

    const order = getDb().orders.find((item) => item.id === params.orderId)
    if (!order) return notFound('Pedido não encontrado.')
    if (order.userId !== auth.user.id) {
      return errorResponse(403, 'FORBIDDEN', 'Este pedido pertence a outra conta.')
    }

    settleOrderIfDue(order)
    return HttpResponse.json(toPublicOrder(order))
  }),
]
