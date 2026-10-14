import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import type { NftUpdatedEvent } from '@/api/types'
import { socketUrl } from '@/realtime/socket-url'

type SocketIoConnection = ReturnType<typeof toSocketIo>

// O MSW já remove o "/socket.io/" do caminho, então basta a origem.
export const realtimeLink = ws.link(socketUrl.replace(/^http/, 'ws'))

const openConnections = new Set<SocketIoConnection>()
let offline = false

// O binding responde o handshake com pingInterval de 25s, mas não manda ping.
// Sem isso o socket.io-client derruba a conexão por "ping timeout" a cada ~30s.
const PING_INTERVAL_MS = 20_000

export const realtimeHandler = realtimeLink.addEventListener('connection', (connection) => {
  if (offline) {
    connection.client.close()
    return
  }

  const io = toSocketIo(connection)
  openConnections.add(io)

  const pingTimer = setInterval(() => connection.client.send('2'), PING_INTERVAL_MS)

  connection.client.addEventListener('close', () => {
    clearInterval(pingTimer)
    openConnections.delete(io)
  })
})

export function emitNftUpdated(event: NftUpdatedEvent) {
  for (const io of openConnections) {
    io.client.emit('nft.updated', event)
  }
}

export function goOffline() {
  offline = true
  for (const io of openConnections) {
    io.rawClient.close()
  }
  openConnections.clear()
}

export function goOnline() {
  offline = false
}

export function isOffline() {
  return offline
}
