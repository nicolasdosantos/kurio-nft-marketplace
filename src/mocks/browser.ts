import { setupWorker } from 'msw/browser'
import { loadDb } from './db'
import { handlers } from './handlers'
import { resumePendingOrders, settleDueOrders } from './order-logic'
import { loadScenario } from './scenarios'

export const worker = setupWorker(...handlers)

export async function startMockServer() {
  loadScenario()
  await loadDb()
  // Pedidos que ficaram pendentes antes do refresh voltam a ser acompanhados.
  settleDueOrders()
  resumePendingOrders()

  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: import.meta.env.PROD,
  })
}
