import { useSyncExternalStore } from 'react'

// Estado da conexão fora do módulo do socket, para o header não puxar o
// socket.io-client no carregamento inicial (ele só carrega depois do MSW).
let connected = false
const listeners = new Set<() => void>()

export function setSocketConnected(value: boolean) {
  connected = value
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useSocketStatus() {
  return useSyncExternalStore(subscribe, () => connected)
}
