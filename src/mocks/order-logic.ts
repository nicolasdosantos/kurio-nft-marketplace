import type { Order } from '@/api/contracts/orders'
import { getCart, userCartKey } from './cart-logic'
import { findNft, getDb, saveDb, type StoredOrder } from './db'
import { emitNftUpdated, emitOrderUpdated } from './realtime/connections'

export const PAYMENT_PROCESSING_MS = 2000

const settlementTimers = new Map<string, ReturnType<typeof setTimeout>>()

export function toPublicOrder(order: StoredOrder): Order {
  return {
    id: order.id,
    status: order.status,
    version: order.version,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    failureReason: order.failureReason,
    receipt: order.receipt,
  }
}

function hasStockFor(order: StoredOrder) {
  return order.receipt.items.every((receiptItem) => {
    const nft = findNft(receiptItem.nftId)
    const edition = nft?.editions.find((item) => item.id === receiptItem.editionId)
    return edition !== undefined && edition.stock >= receiptItem.quantity
  })
}

function confirmOrder(order: StoredOrder) {
  const db = getDb()
  const cart = getCart(userCartKey(order.userId))

  for (const receiptItem of order.receipt.items) {
    const nft = findNft(receiptItem.nftId)!
    const edition = nft.editions.find((item) => item.id === receiptItem.editionId)!
    edition.stock -= receiptItem.quantity
    nft.version += 1
    emitNftUpdated(nft)

    // Remove do carrinho só a quantidade comprada.
    const cartItem = cart.items.find(
      (item) => item.nftId === receiptItem.nftId && item.editionId === edition.id,
    )
    if (cartItem) cartItem.quantity -= receiptItem.quantity
  }

  cart.items = cart.items.filter((item) => item.quantity > 0)
  if (order.receipt.couponCode && cart.couponCode === order.receipt.couponCode) {
    cart.couponCode = null
  }
  cart.version += 1
  db.quotes = db.quotes.filter((quote) => quote.cartKey !== userCartKey(order.userId))

  order.status = 'confirmed'
  order.receipt.confirmedAt = new Date().toISOString()
}

// O desfecho depende só do tempo desde a criação, não de um timer ter rodado.
// Assim, depois de um refresh no meio do pagamento, a primeira leitura resolve o pedido.
export function settleOrderIfDue(order: StoredOrder) {
  if (order.status !== 'pending' || Date.now() < order.settleAt) return false

  if (order.plannedOutcome === 'declined') {
    order.status = 'declined'
    order.failureReason = 'PAYMENT_DECLINED'
  } else if (!hasStockFor(order)) {
    order.status = 'declined'
    order.failureReason = 'OUT_OF_STOCK'
  } else {
    confirmOrder(order)
  }

  order.version += 1
  order.updatedAt = new Date().toISOString()
  saveDb()
  emitOrderUpdated(order)
  return true
}

export function settleDueOrders() {
  for (const order of getDb().orders) settleOrderIfDue(order)
}

// O timer só serve para emitir o order.updated na hora certa.
export function scheduleSettlement(order: StoredOrder) {
  clearTimeout(settlementTimers.get(order.id))
  const wait = Math.max(0, order.settleAt - Date.now())
  settlementTimers.set(
    order.id,
    setTimeout(() => {
      settlementTimers.delete(order.id)
      const current = getDb().orders.find((item) => item.id === order.id)
      if (current) settleOrderIfDue(current)
    }, wait),
  )
}

export function resumePendingOrders() {
  for (const order of getDb().orders) {
    if (order.status === 'pending') scheduleSettlement(order)
  }
}
