import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import type { NftUpdatedEvent, OrderUpdatedEvent } from '@/api/contracts/events'
import type { Nft } from '@/api/contracts/nfts'
import type { StoredOrder } from '../db'
import { getDb } from '../db'
import { socketUrl } from '@/realtime/socket-url'

type SocketIoConnection = ReturnType<typeof toSocketIo>

interface OpenConnection {
  io: SocketIoConnection
  token: string | null
  userId: string | null
}

// O MSW já remove o "/socket.io/" do caminho, então basta a origem.
export const realtimeLink = ws.link(socketUrl.replace(/^http/, 'ws'))

const openConnections = new Set<OpenConnection>()
const sentNftEvents: NftUpdatedEvent[] = []
const sentOrderEvents: { userId: string; event: OrderUpdatedEvent }[] = []
let offline = false

// O binding responde o handshake com pingInterval de 25s, mas não manda ping.
// Sem isso o socket.io-client derruba a conexão por "ping timeout" a cada ~30s.
const PING_INTERVAL_MS = 20_000

export const realtimeHandler = realtimeLink.addEventListener('connection', (connection) => {
  if (offline) {
    // Fechar no mesmo tick da abertura às vezes deixava o socket preso em "connecting".
    setTimeout(() => connection.client.close(), 0)
    return
  }

  // O binding responde o CONNECT sozinho e não repassa o `auth` do cliente,
  // por isso o token vem na query string da conexão.
  const token = connection.client.url.searchParams.get('token')
  const session = token
    ? getDb().sessions.find((item) => item.token === token && item.expiresAt > Date.now())
    : undefined

  const openConnection: OpenConnection = {
    io: toSocketIo(connection),
    token,
    userId: session?.userId ?? null,
  }
  openConnections.add(openConnection)

  const pingTimer = setInterval(() => connection.client.send('2'), PING_INTERVAL_MS)

  connection.client.addEventListener('close', () => {
    clearInterval(pingTimer)
    openConnections.delete(openConnection)
  })
})

export function emitNftUpdated(nft: Nft) {
  const event: NftUpdatedEvent = {
    eventId: crypto.randomUUID(),
    type: 'nft.updated',
    resource: { type: 'nft', id: nft.id },
    version: nft.version,
    occurredAt: new Date().toISOString(),
    data: {
      priceEth: nft.priceEth,
      originalPriceEth: nft.originalPriceEth,
      editions: nft.editions.map((edition) => ({ id: edition.id, stock: edition.stock })),
    },
  }
  sentNftEvents.push(event)
  sendNftEvent(event)
}

export function sendNftEvent(event: NftUpdatedEvent) {
  for (const connection of openConnections) {
    connection.io.client.emit('nft.updated', event)
  }
}

export function getSentNftEvents(nftId: string) {
  return sentNftEvents.filter((event) => event.resource.id === nftId)
}

// Pedido é dado privado: só as conexões do dono recebem.
export function emitOrderUpdated(order: StoredOrder) {
  const event: OrderUpdatedEvent = {
    eventId: `${order.id}:v${order.version}`,
    type: 'order.updated',
    resource: { type: 'order', id: order.id },
    version: order.version,
    occurredAt: new Date().toISOString(),
    data: { status: order.status, failureReason: order.failureReason },
  }
  sentOrderEvents.push({ userId: order.userId, event })
  sendOrderEvent(order.userId, event)
}

export function sendOrderEvent(userId: string, event: OrderUpdatedEvent) {
  for (const connection of openConnections) {
    if (connection.userId === userId) {
      connection.io.client.emit('order.updated', event)
    }
  }
}

export function getSentOrderEvents(orderId: string) {
  return sentOrderEvents.filter((sent) => sent.event.resource.id === orderId)
}

export function closeConnectionsForToken(token: string) {
  for (const connection of openConnections) {
    if (connection.token === token) {
      connection.io.rawClient.close()
      openConnections.delete(connection)
    }
  }
}

export function goOffline() {
  offline = true
  for (const connection of openConnections) {
    connection.io.rawClient.close()
  }
  openConnections.clear()
}

export function goOnline() {
  offline = false
}
