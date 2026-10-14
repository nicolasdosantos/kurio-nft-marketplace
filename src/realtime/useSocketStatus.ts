import { useEffect, useState } from 'react'
import { socket } from './socket'

export function useSocketStatus() {
  const [connected, setConnected] = useState(socket.connected)

  useEffect(() => {
    const handleConnect = () => setConnected(true)
    const handleDisconnect = () => setConnected(false)

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
    }
  }, [])

  return connected
}
