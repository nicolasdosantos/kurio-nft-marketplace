import { expect, test, type Page } from '@playwright/test'
import { expectCartCount, loginThroughUi, logoutThroughUi } from '../support/app'
import {
  callApi,
  login,
  orderBody,
  prepareCheckout,
  setScenario,
  startCleanMockServer,
} from '../support/mock-api'

test.beforeEach(async ({ page }) => {
  await startCleanMockServer(page)
})

test.describe('nft.updated no detalhe', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/nft/emerald-ape-042')
    await expect(page.getByTestId('nft-price')).toContainText('1.19 ETH')
    await expect(page.getByTestId('socket-status')).toHaveText('conectado')
  })

  test('preço muda pelo socket e evento repetido ou antigo é ignorado', async ({ page }) => {
    const changePrice = (priceEth: string) =>
      callApi(page, 'POST', '/api/mock-control/nfts/emerald-ape-042', { body: { priceEth } })

    await changePrice('1.50')
    await expect(page.getByTestId('nft-price')).toContainText('1.50 ETH')
    await changePrice('1.75')
    await expect(page.getByTestId('nft-price')).toContainText('1.75 ETH')

    await callApi(page, 'POST', '/api/mock-control/nfts/emerald-ape-042/replay-event', {
      body: { which: 'last' },
    })
    await callApi(page, 'POST', '/api/mock-control/nfts/emerald-ape-042/replay-event', {
      body: { which: 'previous' },
    })
    await page.waitForTimeout(500)
    await expect(page.getByTestId('nft-price')).toContainText('1.75 ETH')
  })

  test('na reconexão revalida via REST o que mudou enquanto estava fora', async ({ page }) => {
    await callApi(page, 'POST', '/api/mock-control/realtime/offline')
    await expect(page.getByTestId('socket-status')).toHaveText('desconectado')

    await callApi(page, 'POST', '/api/mock-control/nfts/emerald-ape-042', {
      body: { priceEth: '2.22' },
    })
    await expect(page.getByTestId('nft-price')).toContainText('1.19 ETH')

    await callApi(page, 'POST', '/api/mock-control/realtime/online')
    await expect(page.getByTestId('socket-status')).toHaveText('conectado', { timeout: 10_000 })
    await expect(page.getByTestId('nft-price')).toContainText('2.22 ETH')
  })
})

test('order.updated da Ana nunca chega para o Bruno', async ({ page }) => {
  const announcement = page.getByTestId('realtime-announcement')
  const anaToken = await login(page, 'ana@kurio.dev')

  await loginThroughUi(page, 'bruno@kurio.dev')
  await expect(page.getByTestId('socket-status')).toHaveText('conectado')

  const firstQuote = await prepareCheckout(page, anaToken)
  await callApi(page, 'POST', '/api/orders', {
    token: anaToken,
    idempotencyKey: 'pedido-ana-1',
    body: orderBody(firstQuote.id),
  })
  await page.waitForTimeout(3000)
  await expect(announcement).toBeEmpty()

  // Controle: com a Ana logada no app, o mesmo tipo de evento chega.
  await logoutThroughUi(page)
  await loginThroughUi(page, 'ana@kurio.dev')
  await expect(page.getByTestId('socket-status')).toHaveText('conectado')

  const secondQuote = await prepareCheckout(page, anaToken)
  await callApi(page, 'POST', '/api/orders', {
    token: anaToken,
    idempotencyKey: 'pedido-ana-2',
    body: orderBody(secondQuote.id),
  })
  await expect(announcement).toHaveText(/Pagamento confirmado/, { timeout: 5000 })
})

test.describe('pedido pendente com o socket desconectado', () => {
  test.beforeEach(async ({ page }) => {
    await loginThroughUi(page, 'ana@kurio.dev')
    await setScenario(page, 'payment-pending')
    await page.goto('/nft/sage-nomad-009')
    await page.getByRole('button', { name: 'Comprar' }).click()
    await expectCartCount(page, 1)
    await page.goto('/pagamento')
    await page.getByRole('button', { name: /^Conectar( carteira)?$/ }).click()
    await expect(page.getByTestId('wallet-status')).toHaveText('Carteira conectada')
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.getByTestId('order-progress')).toContainText('Pagamento pendente')
    await expect(page.getByTestId('socket-status')).toHaveText('conectado')
  })

  async function pendingOrderIds(page: Page) {
    const token = await page.evaluate(() => localStorage.getItem('kurio:token') ?? '')
    const orders = await callApi(page, 'GET', '/api/orders', { token })
    return (orders.body as { id: string }[])
      .map((order) => order.id)
      .filter((id) => id !== 'order-ana-0001')
  }

  test('a confirmação chega depois de reconectar, sem criar outra compra', async ({ page }) => {
    const [orderId] = await pendingOrderIds(page)
    await callApi(page, 'POST', '/api/mock-control/realtime/offline')
    await expect(page.getByTestId('socket-status')).toHaveText('desconectado')

    // A rede confirma enquanto o socket está fora: o evento se perde.
    await callApi(page, 'POST', `/api/mock-control/orders/${orderId}/settle`)
    await callApi(page, 'POST', '/api/mock-control/realtime/online')
    await expect(page.getByTestId('socket-status')).toHaveText('conectado', { timeout: 10_000 })

    await expect(page).toHaveURL(new RegExp(`/pedidos/${orderId}$`), { timeout: 10_000 })
    await expect(page.getByTestId('order-status')).toHaveText(
      'Seus NFTs agora estão na sua carteira',
    )
    expect(await pendingOrderIds(page)).toEqual([orderId])
  })

  test('confirmado com o socket fora: o refresh recupera o mesmo pedido', async ({ page }) => {
    const [orderId] = await pendingOrderIds(page)
    await callApi(page, 'POST', '/api/mock-control/realtime/offline')
    await expect(page.getByTestId('socket-status')).toHaveText('desconectado')
    await callApi(page, 'POST', `/api/mock-control/orders/${orderId}/settle`)

    // O refresh reenvia a tentativa guardada com a mesma chave: volta o pedido já resolvido.
    await page.reload()
    await expect(page).toHaveURL(new RegExp(`/pedidos/${orderId}$`), { timeout: 10_000 })
    await expect(page.getByTestId('order-status')).toHaveText(
      'Seus NFTs agora estão na sua carteira',
    )
    expect(await pendingOrderIds(page)).toEqual([orderId])
  })

  test('pedido confirmado é terminal: evento antigo ou repetido não volta a pendente', async ({
    page,
  }) => {
    const [orderId] = await pendingOrderIds(page)
    await callApi(page, 'POST', `/api/mock-control/orders/${orderId}/settle`)
    await expect(page).toHaveURL(new RegExp(`/pedidos/${orderId}$`))
    await expect(page.getByTestId('order-status')).toHaveText(
      'Seus NFTs agora estão na sua carteira',
    )

    for (const which of ['previous', 'last'] as const) {
      const replay = await callApi(
        page,
        'POST',
        `/api/mock-control/orders/${orderId}/replay-event`,
        {
          body: { which },
        },
      )
      expect(replay.status).toBe(200)
    }
    await page.waitForTimeout(500)
    await expect(page.getByTestId('order-status')).toHaveText(
      'Seus NFTs agora estão na sua carteira',
    )
  })
})
