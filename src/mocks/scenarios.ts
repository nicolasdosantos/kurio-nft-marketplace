import { z } from 'zod'

export const scenarioNameSchema = z.enum([
  'default',
  'slow',
  'variable-latency',
  'out-of-order',
  'timeout',
  'offline',
  'server-error',
  'session-expired',
  'price-changed-at-checkout',
  'edition-sold-out-at-checkout',
  'order-timeout',
  'payment-declined',
  'wallet-rejected',
  'wallet-disconnects',
])
export type ScenarioName = z.infer<typeof scenarioNameSchema>

export const routeFaultSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  // Mesmo formato das rotas do MSW, ex.: "/api/favorites/:nftId"
  path: z.string().startsWith('/api/'),
  status: z.number().int().min(400).max(599),
  times: z.number().int().min(1).default(1),
})
export type RouteFault = z.infer<typeof routeFaultSchema>

export const scenarioDescriptions: Record<ScenarioName, string> = {
  default: 'Latência curta e pagamento confirmado',
  slow: 'Todas as respostas demoram 2,5s',
  'variable-latency': 'Latência entre 200ms e 2s (sequência reproduzível)',
  'out-of-order': 'Listagens antigas respondem depois das novas',
  timeout: 'Requisições nunca respondem (estoura o timeout do cliente)',
  offline: 'Falha de conexão em todas as requisições',
  'server-error': '500 nas leituras e 503 nas escritas',
  'session-expired': 'Rotas autenticadas respondem 401 SESSION_EXPIRED',
  'price-changed-at-checkout': 'O preço sobe no momento de confirmar a compra',
  'edition-sold-out-at-checkout': 'A edição esgota no momento de confirmar a compra',
  'order-timeout': 'O pedido é criado, mas a primeira resposta se perde',
  'payment-declined': 'O pagamento é recusado',
  'wallet-rejected': 'A carteira recusa a conexão',
  'wallet-disconnects': 'A carteira desconecta antes de enviar o pedido',
}

interface ScenarioState {
  name: ScenarioName
  seed: number
  faults: RouteFault[]
  // Cenários "de uma vez só" (ex.: preço muda no checkout) não se repetem no retry.
  checkoutTrapUsed: boolean
}

const STORAGE_KEY = 'kurio:mock-scenario'

let state: ScenarioState = createState('default')
let requestCounter = 0

function createState(name: ScenarioName, seed = 42): ScenarioState {
  return { name, seed, faults: [], checkoutTrapUsed: false }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Sem localStorage o cenário vale só até o refresh.
  }
}

export function loadScenario() {
  const fromUrl = new URLSearchParams(window.location.search).get('scenario')
  const parsedFromUrl = scenarioNameSchema.safeParse(fromUrl)
  if (parsedFromUrl.success) {
    setScenario(parsedFromUrl.data)
    return
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) state = JSON.parse(stored)
  } catch {
    state = createState('default')
  }
}

export function getScenario() {
  return state
}

export function setScenario(name: ScenarioName, seed?: number) {
  state = createState(name, seed)
  requestCounter = 0
  persist()
}

export function addRouteFault(fault: RouteFault) {
  state.faults.push(fault)
  persist()
}

export function clearRouteFaults() {
  state.faults = []
  persist()
}

export function consumeCheckoutTrap() {
  if (state.checkoutTrapUsed) return false
  state.checkoutTrapUsed = true
  persist()
  return true
}

function pathMatches(pattern: string, pathname: string) {
  const regex = new RegExp(`^${pattern.replace(/:[^/]+/g, '[^/]+')}$`)
  return regex.test(pathname)
}

// Devolve o status de uma falha configurada para essa rota, consumindo uma "vez".
export function takeRouteFault(method: string, pathname: string) {
  const fault = state.faults.find(
    (item) => item.method === method && pathMatches(item.path, pathname),
  )
  if (!fault) return null

  fault.times -= 1
  if (fault.times <= 0) {
    state.faults = state.faults.filter((item) => item !== fault)
  }
  persist()
  return fault.status
}

// mulberry32: gerador pseudoaleatório pequeno, para a latência variável ser reproduzível.
function seededRandom(seed: number) {
  let t = (seed + 0x6d2b79f5) | 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export function latencyFor(method: string, pathname: string) {
  requestCounter += 1

  switch (state.name) {
    case 'slow':
      return 2500
    case 'variable-latency':
      return 200 + Math.round(seededRandom(state.seed + requestCounter) * 1800)
    case 'out-of-order':
      // Na listagem, as requisições ímpares demoram mais que as pares seguintes.
      if (method === 'GET' && pathname === '/api/nfts') {
        return requestCounter % 2 === 1 ? 1500 : 150
      }
      return 150
    default:
      return 150
  }
}

export function resetScenario() {
  setScenario('default')
}
