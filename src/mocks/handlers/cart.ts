import { http, HttpResponse } from 'msw'
import {
  addCartItemRequestSchema,
  applyCouponRequestSchema,
  quoteRequestSchema,
  updateCartItemRequestSchema,
} from '@/api/contracts/cart'
import {
  buildQuote,
  findCoupon,
  findEdition,
  getCart,
  isCouponExpired,
  maxQuantityFor,
  resolveCartKey,
  toCartResponse,
  saveQuote,
  toPublicQuote,
} from '../cart-logic'
import { saveDb } from '../db'
import { errorResponse, notFound, readBody } from '../responses'

function outOfStock(available: number) {
  const message =
    available === 0
      ? 'Esta edição está esgotada.'
      : `Só há ${available} ${available === 1 ? 'unidade disponível' : 'unidades disponíveis'}.`
  return errorResponse(409, 'OUT_OF_STOCK', message, { details: { available } })
}

export const cartHandlers = [
  http.get('/api/cart', ({ request }) => {
    const { cartKey, response } = resolveCartKey(request)
    if (response) return response

    return HttpResponse.json(toCartResponse(getCart(cartKey)))
  }),

  http.post('/api/cart/items', async ({ request }) => {
    const { cartKey, response } = resolveCartKey(request)
    if (response) return response
    const parsed = await readBody(request, addCartItemRequestSchema)
    if (parsed.response) return parsed.response
    const { nftId, editionId, quantity } = parsed.body

    const { nft, edition } = findEdition(nftId, editionId)
    if (!nft || !edition) return notFound('NFT ou edição não encontrada.')

    const cart = getCart(cartKey)
    const existing = cart.items.find((item) => item.nftId === nftId && item.editionId === editionId)
    const limit = maxQuantityFor(nftId, editionId)
    const wanted = (existing?.quantity ?? 0) + quantity
    if (wanted > limit) return outOfStock(limit - (existing?.quantity ?? 0))

    if (existing) {
      existing.quantity = wanted
    } else {
      cart.items.push({
        id: `item-${crypto.randomUUID()}`,
        nftId,
        editionId,
        quantity,
        addedPriceEth: nft.priceEth,
      })
    }
    cart.version += 1
    saveDb()
    return HttpResponse.json(toCartResponse(cart))
  }),

  http.patch('/api/cart/items/:itemId', async ({ request, params }) => {
    const { cartKey, response } = resolveCartKey(request)
    if (response) return response
    const parsed = await readBody(request, updateCartItemRequestSchema)
    if (parsed.response) return parsed.response

    const cart = getCart(cartKey)
    const cartItem = cart.items.find((item) => item.id === params.itemId)
    if (!cartItem) return notFound('Item não está no carrinho.')

    const limit = maxQuantityFor(cartItem.nftId, cartItem.editionId)
    if (parsed.body.quantity > limit) return outOfStock(limit)

    cartItem.quantity = parsed.body.quantity
    cart.version += 1
    saveDb()
    return HttpResponse.json(toCartResponse(cart))
  }),

  http.delete('/api/cart/items/:itemId', ({ request, params }) => {
    const { cartKey, response } = resolveCartKey(request)
    if (response) return response

    const cart = getCart(cartKey)
    if (!cart.items.some((item) => item.id === params.itemId)) {
      return notFound('Item não está no carrinho.')
    }
    cart.items = cart.items.filter((item) => item.id !== params.itemId)
    cart.version += 1
    saveDb()
    return HttpResponse.json(toCartResponse(cart))
  }),

  http.put('/api/cart/coupon', async ({ request }) => {
    const { cartKey, response } = resolveCartKey(request)
    if (response) return response
    const parsed = await readBody(request, applyCouponRequestSchema)
    if (parsed.response) return parsed.response

    const coupon = findCoupon(parsed.body.code)
    if (!coupon) {
      return errorResponse(422, 'COUPON_INVALID', 'Código promocional inválido.', {
        fields: { code: 'Código promocional inválido.' },
      })
    }
    if (isCouponExpired(coupon)) {
      return errorResponse(422, 'COUPON_EXPIRED', 'Este código promocional expirou.', {
        fields: { code: 'Este código promocional expirou.' },
      })
    }

    const cart = getCart(cartKey)
    cart.couponCode = coupon.code
    cart.version += 1
    saveDb()
    return HttpResponse.json(toCartResponse(cart))
  }),

  http.delete('/api/cart/coupon', ({ request }) => {
    const { cartKey, response } = resolveCartKey(request)
    if (response) return response

    const cart = getCart(cartKey)
    cart.couponCode = null
    cart.version += 1
    saveDb()
    return HttpResponse.json(toCartResponse(cart))
  }),

  http.post('/api/quote', async ({ request }) => {
    const { cartKey, response } = resolveCartKey(request)
    if (response) return response
    const parsed = await readBody(request, quoteRequestSchema)
    if (parsed.response) return parsed.response

    const quote = buildQuote(cartKey, parsed.body.network)
    saveQuote(quote)
    saveDb()

    return HttpResponse.json(toPublicQuote(quote))
  }),
]
