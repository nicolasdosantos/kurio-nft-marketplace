import { io } from 'socket.io-client'
import { socketUrl } from './socket-url'

// Só websocket: o @mswjs/socket.io-binding não intercepta o long-polling HTTP.
export const socket = io(socketUrl, {
  transports: ['websocket'],
  autoConnect: false,
  reconnectionDelay: 500,
  reconnectionDelayMax: 3000,
})
