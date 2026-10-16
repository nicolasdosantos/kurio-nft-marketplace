import { expect, test } from '@playwright/test'
import { isDesktopLayout } from '../support/app'
import { callApi, login, orderBody, startCleanMockServer } from '../support/mock-api'

// Fontes e renderização mudam de um sistema para outro: a comparação só vale dentro
// da imagem oficial do Playwright (pnpm test:visual).
test.skip(!process.env.PLAYWRIGHT_DOCKER, 'regressão visual roda no Docker: pnpm test:visual')

// Os mesmos itens do frame 11:4385.
const items = [
  ['emerald-ape-042', '1-50', 2],
  ['violet-nomad-314', 'open', 6],
  ['ivory-baron-088', 'open', 9],
] as const

test('regressão visual do comprovante', async ({ page }) => {
  await startCleanMockServer(page)
  const token = await login(page, 'ana@kurio.dev')
  for (const [nftId, editionId, quantity] of items) {
    await callApi(page, 'POST', '/api/cart/items', { token, body: { nftId, editionId, quantity } })
  }
  await callApi(page, 'POST', '/api/wallets/primary/connect', {
    token,
    body: { network: 'ethereum' },
  })
  const quote = await callApi(page, 'POST', '/api/quote', { token, body: { network: 'ethereum' } })
  const order = await callApi(page, 'POST', '/api/orders', {
    token,
    idempotencyKey: 'visual-comprovante',
    body: orderBody(quote.body.id),
  })
  await expect
    .poll(async () => {
      const current = await callApi(page, 'GET', `/api/orders/${order.body.id}`, { token })
      return current.body.status
    })
    .toBe('confirmed')
  await page.evaluate((value) => localStorage.setItem('kurio:token', value), token)

  await page.goto(`/pedidos/${order.body.id}`)
  await expect(page.getByTestId('order-status')).toHaveText('Seus NFTs agora estão na sua carteira')
  await page.evaluate(async () => {
    for (const image of document.images) image.loading = 'eager'
    await Promise.all([...document.images].map((image) => image.decode().catch(() => undefined)))
  })
  await page.evaluate(() => document.fonts.ready)

  // Hash e data mudam a cada pedido.
  await expect(page).toHaveScreenshot('comprovante.png', {
    fullPage: !isDesktopLayout(page),
    animations: 'disabled',
    mask: [
      page.getByTestId('realtime-announcement'),
      page.getByTestId('receipt-hash'),
      page.getByTestId('receipt-hash-short'),
      page.getByTestId('receipt-date'),
    ],
    maxDiffPixelRatio: 0.01,
  })
})
