import Decimal from 'decimal.js'
import type { Cart, Quote, QuoteIssue } from '@/api/contracts/cart'
import type { Network } from '@/api/contracts/common'
import type { EditionId } from '@/api/contracts/nfts'
import { couponFixtures, networkFeeEth } from './fixtures/users'
import { findNft, getDb, type StoredCart, type StoredQuote } from './db'
import { errorResponse, findSessionUser } from './responses'

const QUOTE_DURATION_MS = 10 * 60 * 1000

export function userCartKey(userId: string) {
  return `user:${userId}`
}

// Logado: carrinho do usuário. Visitante: carrinho identificado pelo header X-Cart-Id.
export function resolveCartKey(request: Request) {
  const user = findSessionUser(request)
  if (user) return { cartKey: userCartKey(user.id), response: undefined }

  if (request.headers.has('Authorization')) {
    return {
      cartKey: undefined,
      response: errorResponse(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.'),
    }
  }

  const guestCartId = request.headers.get('X-Cart-Id')
  if (!guestCartId) {
    return {
      cartKey: undefined,
      response: errorResponse(400, 'BAD_REQUEST', 'Informe o header X-Cart-Id.'),
    }
  }
  return { cartKey: `guest:${guestCartId}`, response: undefined }
}

export function getCart(cartKey: string): StoredCart {
  const db = getDb()
  db.carts[cartKey] ??= { items: [], couponCode: null, version: 1 }
  return db.carts[cartKey]
}

export function findEdition(nftId: string, editionId: EditionId) {
  const nft = findNft(nftId)
  const edition = nft?.editions.find((item) => item.id === editionId)
  return { nft, edition }
}

// Quanto ainda dá para colocar no carrinho: o menor entre estoque e limite por pedido.
export function maxQuantityFor(nftId: string, editionId: EditionId) {
  const { edition } = findEdition(nftId, editionId)
  if (!edition) return 0
  return Math.min(edition.stock, edition.maxPerOrder)
}

export function toCartResponse(cart: StoredCart): Cart {
  const items = cart.items.flatMap((item) => {
    const { nft, edition } = findEdition(item.nftId, item.editionId)
    if (!nft || !edition) return []
    return [
      {
        id: item.id,
        nftId: item.nftId,
        editionId: item.editionId,
        editionLabel: edition.label,
        quantity: item.quantity,
        name: nft.name,
        tokenId: nft.tokenId,
        imageUrl: nft.imageUrl,
        unitPriceEth: nft.priceEth,
        addedPriceEth: item.addedPriceEth,
        stock: edition.stock,
        maxPerOrder: edition.maxPerOrder,
      },
    ]
  })
  return { items, couponCode: cart.couponCode, version: cart.version }
}

export function findCoupon(code: string) {
  return couponFixtures.find((coupon) => coupon.code === code.trim().toUpperCase())
}

export function isCouponExpired(coupon: { expiresAt: string }) {
  return Date.parse(coupon.expiresAt) <= Date.now()
}

function formatEth(value: Decimal) {
  return value.toDecimalPlaces(6).toFixed()
}

export function buildQuote(cartKey: string, network: Network): StoredQuote {
  const cart = getCart(cartKey)
  let subtotal = new Decimal(0)

  const lines = cart.items.flatMap((item) => {
    const { nft, edition } = findEdition(item.nftId, item.editionId)
    if (!nft || !edition) return []

    const issues: QuoteIssue[] = []
    if (nft.priceEth !== item.addedPriceEth) issues.push('PRICE_CHANGED')
    if (edition.stock === 0) issues.push('OUT_OF_STOCK')
    else if (item.quantity > edition.stock) issues.push('QUANTITY_EXCEEDS_STOCK')

    const lineTotal = new Decimal(nft.priceEth).times(item.quantity)
    subtotal = subtotal.plus(lineTotal)

    return [
      {
        itemId: item.id,
        nftId: item.nftId,
        editionId: item.editionId,
        quantity: item.quantity,
        unitPriceEth: nft.priceEth,
        lineTotalEth: formatEth(lineTotal),
        issues,
      },
    ]
  })

  const coupon = cart.couponCode ? findCoupon(cart.couponCode) : undefined
  const activeCoupon = coupon && !isCouponExpired(coupon) ? coupon : undefined
  const discount = activeCoupon
    ? subtotal.times(activeCoupon.percentOff).dividedBy(100)
    : new Decimal(0)
  const fee = lines.length > 0 ? new Decimal(networkFeeEth[network]) : new Decimal(0)
  const total = subtotal.minus(discount).plus(fee)

  const now = Date.now()
  const hasStockIssue = lines.some((line) =>
    line.issues.some((issue) => issue === 'OUT_OF_STOCK' || issue === 'QUANTITY_EXCEEDS_STOCK'),
  )

  return {
    id: `quote-${crypto.randomUUID()}`,
    cartKey,
    createdAt: now,
    cartVersion: cart.version,
    network,
    expiresAt: new Date(now + QUOTE_DURATION_MS).toISOString(),
    valid: lines.length > 0 && !hasStockIssue,
    lines,
    coupon: activeCoupon ? { code: activeCoupon.code, percentOff: activeCoupon.percentOff } : null,
    subtotalEth: formatEth(subtotal),
    discountEth: formatEth(discount),
    networkFeeEth: formatEth(fee),
    totalEth: formatEth(total),
  }
}

// Compara o que importa para o preço final; id e datas mudam sempre.
export function quotesMatch(previous: Quote, current: Quote) {
  const summary = (quote: Quote) =>
    JSON.stringify({
      network: quote.network,
      lines: quote.lines.map((line) => [
        line.nftId,
        line.editionId,
        line.quantity,
        line.unitPriceEth,
      ]),
      coupon: quote.coupon?.code ?? null,
      totals: [quote.subtotalEth, quote.discountEth, quote.networkFeeEth, quote.totalEth],
    })
  return summary(previous) === summary(current)
}

// Ao entrar, os itens do visitante vão para o carrinho do usuário (somando e
// respeitando o estoque) e o carrinho do visitante é apagado, para não voltar depois.
export function mergeGuestCart(guestCartId: string, userId: string) {
  const db = getDb()
  const guestKey = `guest:${guestCartId}`
  const guestCart = db.carts[guestKey]
  if (!guestCart) return

  const userCart = getCart(userCartKey(userId))
  for (const guestItem of guestCart.items) {
    const existing = userCart.items.find(
      (item) => item.nftId === guestItem.nftId && item.editionId === guestItem.editionId,
    )
    const limit = maxQuantityFor(guestItem.nftId, guestItem.editionId)

    if (existing) {
      existing.quantity = Math.min(existing.quantity + guestItem.quantity, limit)
    } else if (limit > 0) {
      userCart.items.push({ ...guestItem, quantity: Math.min(guestItem.quantity, limit) })
    }
  }
  if (!userCart.couponCode) userCart.couponCode = guestCart.couponCode

  userCart.items = userCart.items.filter((item) => item.quantity > 0)
  userCart.version += 1
  delete db.carts[guestKey]
}

export function toPublicQuote(quote: StoredQuote): Quote {
  return {
    id: quote.id,
    cartVersion: quote.cartVersion,
    network: quote.network,
    expiresAt: quote.expiresAt,
    valid: quote.valid,
    lines: quote.lines,
    coupon: quote.coupon,
    subtotalEth: quote.subtotalEth,
    discountEth: quote.discountEth,
    networkFeeEth: quote.networkFeeEth,
    totalEth: quote.totalEth,
  }
}

// Guarda a cotação sem apagar as anteriores ainda válidas: a tela pode estar
// usando uma cotação de alguns segundos atrás, e ela continua valendo até expirar.
export function saveQuote(quote: StoredQuote) {
  const db = getDb()
  const now = Date.now()
  db.quotes = db.quotes.filter((item) => Date.parse(item.expiresAt) > now)
  db.quotes.push(quote)
}
