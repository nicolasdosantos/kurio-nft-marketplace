import { expect, test } from '@playwright/test'
import { isDesktopLayout } from '../support/app'
import { callApi, startCleanMockServer } from '../support/mock-api'

// Fontes e renderização mudam de um sistema para outro: a comparação só vale dentro
// da imagem oficial do Playwright (pnpm test:visual).
test.skip(!process.env.PLAYWRIGHT_DOCKER, 'regressão visual roda no Docker: pnpm test:visual')

// Os mesmos itens dos frames do Figma (desktop 11:1278, mobile 16:360).
const desktopItems = [
  ['emerald-ape-042', '1-50', 2],
  ['violet-nomad-314', 'open', 6],
  ['ivory-baron-088', 'open', 9],
] as const
const mobileItems = [
  ['emerald-ape-042', '1-50', 1],
  ['violet-nomad-314', '1-1', 1],
  ['ivory-baron-088', '1-10', 2],
  ['golden-beat-207', '1-50', 2],
] as const

test('regressão visual do carrinho', async ({ page }) => {
  await startCleanMockServer(page)
  const cartId = await page.evaluate(() => localStorage.getItem('kurio:guest-cart-id') ?? '')
  for (const [nftId, editionId, quantity] of isDesktopLayout(page) ? desktopItems : mobileItems) {
    await callApi(page, 'POST', '/api/cart/items', {
      cartId,
      body: { nftId, editionId, quantity },
    })
  }

  await page.goto('/carrinho')
  await expect(page.getByTestId('cart-total')).toBeVisible()
  await expect(
    page.getByRole('region', { name: 'Colecionadores também viram' }).getByRole('link').first(),
  ).toBeVisible()

  // As imagens abaixo da dobra são lazy; na captura de página inteira todas precisam estar lá.
  await page.evaluate(async () => {
    for (const image of document.images) image.loading = 'eager'
    await Promise.all([...document.images].map((image) => image.decode().catch(() => undefined)))
  })
  await page.evaluate(() => document.fonts.ready)

  await expect(page).toHaveScreenshot('carrinho.png', {
    fullPage: true,
    animations: 'disabled',
    mask: [page.getByTestId('realtime-announcement')],
    maxDiffPixelRatio: 0.01,
  })
})
