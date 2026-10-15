import { io } from 'socket.io-client'
import { socketUrl } from './socket-url'
import { setSocketConnected } from './useSocketStatus'

// Só websocket: o @mswjs/socket.io-binding não intercepta o long-polling HTTP.
export const socket = io(socketUrl, {
  transports: ['websocket'],
  autoConnect: false,
  reconnectionDelay: 500,
  reconnectionDelayMax: 3000,
  // Tentativa de conexão travada não deve segurar a reconexão por 20s (o padrão).
  timeout: 5000,
})

socket.on('connect', () => setSocketConnected(true))
socket.on('disconnect', () => setSocketConnected(false))

// O token vai na query porque o mock não recebe o `auth` do handshake.
export function connectSocket(token: string | null) {
  socket.disconnect()
  socket.io.opts.query = token ? { token } : {}
  socket.connect()
}
