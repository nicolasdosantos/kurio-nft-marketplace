import { useSyncExternalStore } from 'react'

// Mensagem lida pelo leitor de tela quando algo muda em tempo real.
let currentAnnouncement = ''
const listeners = new Set<() => void>()

export function announce(message: string) {
  currentAnnouncement = message
  for (const listener of listeners) listener()
}

export function useAnnouncement() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => currentAnnouncement,
  )
}
