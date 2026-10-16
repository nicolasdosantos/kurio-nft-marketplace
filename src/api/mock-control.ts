import { http } from './http'

// Chamadas à API de controle dos mocks (/api/mock-control). Só o painel de simulação usa;
// os testes chamam a mesma API direto pelo fetch.

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
