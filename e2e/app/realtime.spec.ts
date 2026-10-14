import { expect, test } from '@playwright/test'
import { loginThroughUi, logoutThroughUi } from '../support/app'
import {
  callApi,
  login,
  orderBody,
  prepareCheckout,
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
