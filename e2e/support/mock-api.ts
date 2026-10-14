import type { Page } from '@playwright/test'

interface CallOptions {
  body?: unknown
  token?: string
  cartId?: string
  idempotencyKey?: string
}

// Nos testes o corpo é inspecionado livremente; tipar cada resposta aqui só atrapalharia.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBody = any

export interface ApiResult<Body = AnyBody> {
  status: number
  body: Body
}

// As requisições saem de dentro da página, onde o MSW está ativo.
// status 0 = falha de rede (ex.: cenário offline ou resposta perdida).
export async function callApi<Body = AnyBody>(
  page: Page,
  method: string,
  path: string,
  options: CallOptions = {},
): Promise<ApiResult<Body>> {
  return page.evaluate(
    async ({ method, path, options }) => {
      const headers: Record<string, string> = {}
      if (options.body !== undefined) headers['Content-Type'] = 'application/json'
      if (options.token) headers.Authorization = `Bearer ${options.token}`
      if (options.cartId) headers['X-Cart-Id'] = options.cartId
      if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey

      try {
        const response = await fetch(path, {
          method,
          headers,
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
        })
        const text = await response.text()
        return { status: response.status, body: text ? JSON.parse(text) : null }
      } catch {
        return { status: 0, body: null }
      }
    },
    { method, path, options },
  )
}

export async function login(page: Page, email: string, extra: { guestCartId?: string } = {}) {
  const result = await callApi(page, 'POST', '/api/auth/login', {
    body: { email, password: 'kurio123', ...extra },
  })
  if (result.status !== 200) throw new Error(`login falhou: ${result.status}`)
  return result.body.token as string
}

// O app só renderiza depois do worker do MSW pronto; antes disso o fetch escaparia dos mocks.
export async function waitForMocks(page: Page) {
  await page.getByRole('heading', { level: 1 }).waitFor()
}

export async function startCleanMockServer(page: Page) {
  await page.goto('/')
  await waitForMocks(page)
  await callApi(page, 'POST', '/api/mock-control/reset')
}

export async function setScenario(page: Page, name: string) {
  await callApi(page, 'PUT', '/api/mock-control/scenario', { body: { name } })
}

// Coloca 2x Emerald Ape #042 (edição 1/50) no carrinho, conecta a carteira e gera a cotação.
export async function prepareCheckout(page: Page, token: string) {
  await callApi(page, 'POST', '/api/cart/items', {
    token,
    body: { nftId: 'emerald-ape-042', editionId: '1-50', quantity: 2 },
  })
  await callApi(page, 'POST', '/api/wallets/primary/connect', {
    token,
    body: { network: 'ethereum' },
  })
  const quote = await callApi(page, 'POST', '/api/quote', {
    token,
    body: { network: 'ethereum' },
  })
  return quote.body
}

export function orderBody(quoteId: string) {
  return {
    quoteId,
    walletSlot: 'primary',
    network: 'ethereum',
    collector: { displayName: 'Ana Ribeiro', username: 'ana.ribeiro', email: 'ana@kurio.dev' },
  }
}
