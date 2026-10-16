import { expect, test, type Page } from '@playwright/test'
import { expectCartCount, isDesktopLayout, loginThroughUi, profileEmail } from '../support/app'
import { callApi, startCleanMockServer } from '../support/mock-api'

// Relógio falso que continua andando (install, sem pausar): React Query e socket seguem
// normais. Para "passar" 30 min de sessão ou 10 min de cotação usamos setSystemTime, que
// adianta o Date.now() sem disparar timers (o fastForward dispararia, por exemplo, o
// timeout de 10s do Axios das requisições em andamento). A API simulada roda na página,
// então o Date.now() dela é o mesmo relógio.
test.beforeEach(async ({ page }) => {
  await page.clock.install()
  await startCleanMockServer(page)
  await loginThroughUi(page, 'ana@kurio.dev')
})

async function skipMinutes(page: Page, minutes: number) {
  const now = await page.evaluate(() => Date.now())
  await page.clock.setSystemTime(now + minutes * 60_000)
}

async function openProfileMenu(page: Page, timeout?: number) {
  if (isDesktopLayout(page)) {
    await page.getByTestId('current-user').click({ timeout })
    await page.getByRole('menuitem', { name: 'Dados do perfil' }).click({ timeout })
  } else {
    await page.getByRole('link', { name: 'Minha conta' }).click({ timeout })
  }
}

test('token vence durante a navegação: login de novo e volta para onde estava', async ({
  page,
}) => {
  await page.goto('/')
  await skipMinutes(page, 29)
  // Ainda dentro dos 30 min: a navegação funciona.
  await openProfileMenu(page)
  await expect(profileEmail(page)).toHaveValue('ana@kurio.dev')

  // Volta ao Início pela interface (sem recarregar) e o token vence com a página aberta.
  await page.getByRole('link', { name: 'Início', exact: true }).first().click()
  await expect(page).toHaveURL(/\/$/)
  await skipMinutes(page, 1.5)
  // Abrir o perfil faz uma requisição autenticada. Às vezes uma busca de fundo do Início
  // recebe o 401 antes e o app já vai para o login: os dois caminhos valem.
  await openProfileMenu(page, 5_000).catch(() => undefined)
  await expect(page).toHaveURL(/\/login\?.*expired=true/)
  await expect(page.getByText('Sua sessão expirou')).toBeVisible()

  // Depois de entrar de novo, volta exatamente para onde estava.
  const redirect = new URL(page.url()).searchParams.get('redirect') ?? ''
  expect(['/', '/perfil']).toContain(redirect)
  await loginThroughUi(page, 'ana@kurio.dev')
  await expect(page).toHaveURL(new RegExp(`${redirect.replace('/', '\\/')}$`))
  if (redirect === '/perfil') await expect(profileEmail(page)).toHaveValue('ana@kurio.dev')
})

test('token vence durante o checkout: volta ao pagamento e compra uma vez só', async ({ page }) => {
  await page.goto('/nft/sage-nomad-009')
  await page.getByRole('button', { name: 'Comprar' }).click()
  await expectCartCount(page, 1)
  await page.goto('/pagamento')
  await page.getByRole('button', { name: /^Conectar( carteira)?$/ }).click()
  await expect(page.getByTestId('wallet-status')).toHaveText('Carteira conectada')

  await skipMinutes(page, 31)
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page).toHaveURL(/\/login\?.*expired=true/)
  await expect(page).toHaveURL(/redirect=%2Fpagamento/)

  await loginThroughUi(page, 'ana@kurio.dev')
  await expect(page).toHaveURL(/\/pagamento$/)
  await expect(page.getByTestId('checkout-total')).toHaveText('1.706 ETH')
  await page.getByRole('button', { name: /^Conectar( carteira)?$/ }).click()
  await expect(page.getByTestId('wallet-status')).toHaveText('Carteira conectada')
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page).toHaveURL(/\/pedidos\/order-/)

  const token = await page.evaluate(() => localStorage.getItem('kurio:token') ?? '')
  const orders = await callApi(page, 'GET', '/api/orders', { token })
  expect((orders.body as { id: string }[]).filter((o) => o.id !== 'order-ana-0001')).toHaveLength(1)
})

test('cotação vencida não é usada: a nova tentativa pede uma cotação nova', async ({ page }) => {
  await page.goto('/nft/sage-nomad-009')
  await page.getByRole('button', { name: 'Comprar' }).click()
  await expectCartCount(page, 1)
  await page.goto('/pagamento')
  await page.getByRole('button', { name: /^Conectar( carteira)?$/ }).click()
  await expect(page.getByTestId('wallet-status')).toHaveText('Carteira conectada')
  await expect(page.getByTestId('checkout-total')).toHaveText('1.706 ETH')

  // O pedido não chega ao servidor (503 no envio e nos 3 retries).
  await callApi(page, 'POST', '/api/mock-control/faults', {
    body: { method: 'POST', path: '/api/orders', status: 503, times: 4 },
  })
  const quoteIds: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/orders')) {
      quoteIds.push(JSON.parse(request.postData() ?? '{}').quoteId)
    }
  })
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  const progress = page.getByTestId('order-progress')
  await expect(progress).toContainText('Não recebemos a resposta', { timeout: 15_000 })

  // 11 min depois a cotação (10 min) venceu: o reenvio com a mesma tentativa é recusado.
  await skipMinutes(page, 11)
  await progress.getByRole('button', { name: 'Tentar de novo' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Revise o pedido' })).toBeVisible()
  await expect(page).toHaveURL(/\/pagamento$/)

  // Confirmar de novo revalida a cotação e envia com uma nova, ainda válida.
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page).toHaveURL(/\/pedidos\/order-/)
  expect(new Set(quoteIds).size).toBe(2)
  expect(quoteIds.at(-1)).not.toBe(quoteIds[0])
})
