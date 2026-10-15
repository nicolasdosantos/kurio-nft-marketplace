import type { CreateOrderRequest } from '@/api/contracts/orders'

// Tentativa de compra em andamento: a mesma Idempotency-Key e o mesmo corpo. Fica no
// sessionStorage para, depois de um refresh no meio do envio, reenviar exatamente o
// mesmo pedido; o servidor devolve o pedido já criado em vez de criar outro.
const STORAGE_KEY = 'kurio:checkout-attempt'

export interface CheckoutAttempt {
  userId: string
  idempotencyKey: string
  order: CreateOrderRequest
  orderId?: string
}

export function readCheckoutAttempt(userId: string): CheckoutAttempt | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    const attempt = JSON.parse(stored) as CheckoutAttempt
    return attempt.userId === userId ? attempt : null
  } catch {
    return null
  }
}

export function saveCheckoutAttempt(attempt: CheckoutAttempt) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attempt))
  } catch {
    // Sem sessionStorage a recuperação após refresh não funciona, mas a compra segue.
  }
}

export function clearCheckoutAttempt() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nada a limpar.
  }
}
