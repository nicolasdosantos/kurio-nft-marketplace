import { http } from './http'

// Chamadas ao "servidor" simulado. Só a página da PoC e o painel de demonstração usam.
export async function raiseNftPrice(nftId: string) {
  await http.post(`/mock-control/nfts/${nftId}`, { raiseByEth: '0.10' })
}

export async function replayNftEvent(nftId: string, which: 'last' | 'previous') {
  await http.post(`/mock-control/nfts/${nftId}/replay-event`, { which })
}

export async function setRealtimeOnline(online: boolean) {
  await http.post(`/mock-control/realtime/${online ? 'online' : 'offline'}`)
}

export interface MockScenarioState {
  name: string
  available: Record<string, string>
  faults: { method: string; path: string; status: number; times: number }[]
}

export async function fetchMockScenario() {
  const response = await http.get<MockScenarioState>('/mock-control/scenario')
  return response.data
}

export async function changeMockScenario(name: string) {
  await http.put('/mock-control/scenario', { name })
}

export async function resetMockServer() {
  await http.post('/mock-control/reset')
}

export async function expireMockSessions() {
  await http.post('/mock-control/expire-sessions')
}

export async function disconnectMockWallets() {
  await http.post('/mock-control/wallets/disconnect')
}
