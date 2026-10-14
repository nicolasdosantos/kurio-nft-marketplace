import type { Wallet, WalletSlot } from '@/api/contracts/account'
import type { User } from '@/api/contracts/auth'
import type { Quote } from '@/api/contracts/cart'
import type { Network } from '@/api/contracts/common'
import type { EditionId, Nft } from '@/api/contracts/nfts'
import type { Order } from '@/api/contracts/orders'
import { nftFixtures } from './fixtures/nfts'
import { userFixtures } from './fixtures/users'
import { createSalt, hashPassword } from './password'
import { buildSeedOrders } from './fixtures/orders'

export interface StoredUser extends User {
  passwordHash: string
  passwordSalt: string
}

export interface Session {
  token: string
  userId: string
  expiresAt: number
}

export interface StoredCartItem {
  id: string
  nftId: string
  editionId: EditionId
  quantity: number
  addedPriceEth: string
}

export interface StoredCart {
  items: StoredCartItem[]
  couponCode: string | null
  version: number
}

export interface StoredQuote extends Quote {
  cartKey: string
  createdAt: number
}

export interface StoredOrder extends Order {
  userId: string
  idempotencyKey: string
  requestFingerprint: string
  // Decidido na criação, a partir do cenário ativo. Assim o refresh não muda o desfecho.
  plannedOutcome: 'confirmed' | 'declined'
  settleAt: number
}

export interface WalletState {
  primary: Wallet | null
  secondary: Wallet | null
  connected: Partial<Record<WalletSlot, Network>>
}

export interface MockDb {
  users: StoredUser[]
  sessions: Session[]
  nfts: Nft[]
  favorites: Record<string, string[]>
  carts: Record<string, StoredCart>
  quotes: StoredQuote[]
  orders: StoredOrder[]
  wallets: Record<string, WalletState>
}

const STORAGE_KEY = 'kurio:mock-db:v1'

let db: MockDb

export function getDb() {
  return db
}

export function saveDb() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    // Sem localStorage (aba privada, cota cheia): segue só em memória.
  }
}

async function buildInitialDb(): Promise<MockDb> {
  const users: StoredUser[] = []
  const favorites: MockDb['favorites'] = {}
  const wallets: MockDb['wallets'] = {}
  const now = new Date().toISOString()

  for (const fixture of userFixtures) {
    const passwordSalt = createSalt()
    users.push({
      id: fixture.id,
      displayName: fixture.displayName,
      username: fixture.username,
      email: fixture.email,
      ensName: fixture.ensName,
      walletNickname: fixture.walletNickname,
      avatarUrl: null,
      passwordSalt,
      passwordHash: await hashPassword(fixture.password, passwordSalt),
    })
    favorites[fixture.id] = [...fixture.favorites]
    wallets[fixture.id] = {
      primary: { slot: 'primary', ...fixture.primaryWallet, updatedAt: now },
      secondary: fixture.secondaryWallet
        ? { slot: 'secondary', ...fixture.secondaryWallet, updatedAt: now }
        : null,
      connected: {},
    }
  }

  return {
    users,
    sessions: [],
    nfts: structuredClone(nftFixtures),
    favorites,
    carts: {},
    quotes: [],
    orders: buildSeedOrders(),
    wallets,
  }
}

export async function loadDb() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      db = JSON.parse(stored)
      return
    }
  } catch {
    // JSON corrompido: cai no reset abaixo.
  }
  await resetDb()
}

export async function resetDb() {
  db = await buildInitialDb()
  saveDb()
}

export function findNft(nftId: string) {
  return db.nfts.find((nft) => nft.id === nftId)
}

export function toPublicUser(user: StoredUser): User {
  return {
    id: user.id,
    displayName: user.displayName,
    username: user.username,
    email: user.email,
    ensName: user.ensName,
    walletNickname: user.walletNickname,
    avatarUrl: user.avatarUrl,
  }
}
