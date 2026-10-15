import { expect, test, type Page } from '@playwright/test'
import { expectCartCount, loginThroughUi } from '../support/app'
import { callApi, setScenario, startCleanMockServer } from '../support/mock-api'

test.beforeEach(async ({ page }) => {
  await startCleanMockServer(page)
  await loginThroughUi(page, 'ana@kurio.dev')
  await page.goto('/nft/sage-nomad-009')
  await page.getByRole('button', { name: 'Comprar' }).click()
  await expectCartCount(page, 1)
})

function sessionToken(page: Page) {
  return page.evaluate(() => localStorage.getItem('kurio:token') ?? '')
}

// Pedidos da Ana além do pedido antigo das fixtures.
async function newOrderIds(page: Page) {
  const orders = await callApi(page, 'GET', '/api/orders', { token: await sessionToken(page) })
  return (orders.body as { id: string }[])
    .map((order) => order.id)
    .filter((orderId) => orderId !== 'order-ana-0001')
}

async function reviewOrder(page: Page) {
  await page.goto('/pagamento')
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(page.getByTestId('wallet-status')).toHaveText('Carteira conectada')
  await page.getByRole('button', { name: 'Revisar pedido' }).click()
}

test('compra do carrinho até o pedido confirmado', async ({ page }) => {
  await reviewOrder(page)
  await expect(page.getByTestId('checkout-total')).toHaveText('1.706 ETH')
  await page.getByRole('button', { name: 'Confirmar compra' }).click()

  await expect(page).toHaveURL(/\/pedidos\/order-/)
  await expect(page.getByTestId('order-status')).toHaveText(/Seus NFTs agora estão na sua carteira/)
  await expect(page.getByText('Transação simulada')).toBeVisible()
  await expectCartCount(page, 0)
})

test('preço alterado na hora da compra exige nova confirmação', async ({ page }) => {
  await setScenario(page, 'price-changed-at-checkout')
  await reviewOrder(page)
  await page.getByRole('button', { name: 'Confirmar compra' }).click()

  await expect(page.getByText(/O novo total é 1.806 ETH/)).toBeVisible()
  await expect(page).toHaveURL(/\/pagamento$/)

  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page).toHaveURL(/\/pedidos\/order-/)
})

test('preço muda pelo socket durante a revisão e pede nova confirmação', async ({ page }) => {
  await reviewOrder(page)
  await expect(page.getByTestId('checkout-total')).toHaveText('1.706 ETH')
  await expect(page.getByTestId('socket-status')).toHaveText('conectado')

  await callApi(page, 'POST', '/api/mock-control/nfts/sage-nomad-009', {
    body: { priceEth: '1.80' },
  })
  await expect(page.getByTestId('checkout-status')).toContainText('O novo total é 1.816 ETH')
  await expect(page.getByRole('button', { name: 'Confirmar compra' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Revisar novo total' }).click()
  await expect(page.getByTestId('checkout-total')).toHaveText('1.816 ETH')
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page).toHaveURL(/\/pedidos\/order-/)
})

test('clique repetido em confirmar cria um pedido só', async ({ page }) => {
  await reviewOrder(page)
  const posts: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/orders')) {
      posts.push(request.headers()['idempotency-key'] ?? '')
    }
  })
  await page.getByRole('button', { name: 'Confirmar compra' }).dblclick()

  await expect(page).toHaveURL(/\/pedidos\/order-/)
  expect(posts).toHaveLength(1)
  expect(await newOrderIds(page)).toHaveLength(1)
})

test('timeout na criação recupera o mesmo pedido com a mesma chave', async ({ page }) => {
  await setScenario(page, 'order-timeout')
  await reviewOrder(page)
  const keys: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/orders')) {
      keys.push(request.headers()['idempotency-key'] ?? '')
    }
  })
  await page.getByRole('button', { name: 'Confirmar compra' }).click()

  // A 1ª resposta se perde; o retry usa a mesma Idempotency-Key e recebe o pedido criado.
  await expect(page).toHaveURL(/\/pedidos\/order-/, { timeout: 10_000 })
  expect(keys.length).toBeGreaterThanOrEqual(2)
  expect(new Set(keys).size).toBe(1)
  expect(await newOrderIds(page)).toHaveLength(1)
})

test('refresh no meio do envio retoma a mesma compra', async ({ page }) => {
  await setScenario(page, 'order-timeout')
  await reviewOrder(page)
  const firstAttemptLost = page.waitForEvent(
    'requestfailed',
    (request) => request.method() === 'POST' && request.url().endsWith('/api/orders'),
  )
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await firstAttemptLost

  // O pedido já foi criado no servidor, mas a resposta não chegou: o usuário recarrega.
  await page.reload()
  await expect(page).toHaveURL(/\/pedidos\/order-/, { timeout: 10_000 })
  await expect(page.getByTestId('order-status')).toHaveText(/Seus NFTs agora estão na sua carteira/)
  expect(await newOrderIds(page)).toHaveLength(1)
})

test('pagamento recusado mantém o carrinho', async ({ page }) => {
  await setScenario(page, 'payment-declined')
  await reviewOrder(page)
  await page.getByRole('button', { name: 'Confirmar compra' }).click()

  await expect(page.getByTestId('order-status')).toContainText('Pedido recusado')
  await expect(page.getByTestId('order-status')).toContainText('recusado pela carteira')
  await expectCartCount(page, 1)
})

test('confirmação tira do carrinho só o que foi comprado, mesmo após refresh', async ({ page }) => {
  await reviewOrder(page)
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page).toHaveURL(/\/pedidos\/order-/)
  await expect(page.getByTestId('order-status')).toHaveText(/Aguardando confirmação/)

  // Item que entrou no carrinho depois do pedido: não faz parte da compra.
  await callApi(page, 'POST', '/api/cart/items', {
    token: await sessionToken(page),
    body: { nftId: 'emerald-ape-042', editionId: '1-50', quantity: 2 },
  })
  await page.reload()
  await expect(page.getByTestId('order-status')).toHaveText(/Seus NFTs agora estão na sua carteira/)
  await expectCartCount(page, 2)
})
