import { useSyncExternalStore } from 'react'
import type { User } from '@/api/contracts/auth'

const TOKEN_KEY = 'kurio:token'
const GUEST_CART_KEY = 'kurio:guest-cart-id'

interface SessionState {
  token: string | null
  user: User | null
}

let session: SessionState = { token: readStorage(TOKEN_KEY), user: null }
const listeners = new Set<() => void>()

function readStorage(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Sem localStorage a sessão dura só até o refresh.
  }
}

function notify() {
  for (const listener of listeners) listener()
}

export function getSession() {
  return session
}

export function isLoggedIn() {
  return session.token !== null && session.user !== null
}

export function setSession(token: string, user: User) {
  writeStorage(TOKEN_KEY, token)
  session = { token, user }
  notify()
}

export function updateSessionUser(user: User) {
  session = { ...session, user }
  notify()
}

export function clearSession() {
  writeStorage(TOKEN_KEY, null)
  session = { token: null, user: null }
  notify()
}

export function getGuestCartId() {
  let guestCartId = readStorage(GUEST_CART_KEY)
  if (!guestCartId) {
    guestCartId = crypto.randomUUID()
    writeStorage(GUEST_CART_KEY, guestCartId)
  }
  return guestCartId
}

// Depois do logout o visitante começa com um carrinho novo e vazio.
export function startNewGuestCart() {
  writeStorage(GUEST_CART_KEY, crypto.randomUUID())
}

export function subscribeToSession(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useSession() {
  return useSyncExternalStore(subscribeToSession, getSession)
}

// Dono dos dados no cache: o usuário logado ou o carrinho do visitante.
export function cacheOwner(currentSession: SessionState = session) {
  return currentSession.user ? `user:${currentSession.user.id}` : `guest:${getGuestCartId()}`
}
