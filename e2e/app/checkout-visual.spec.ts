import { expect, test } from '@playwright/test'
import { isDesktopLayout } from '../support/app'
import { callApi, login, startCleanMockServer } from '../support/mock-api'

// Fontes e renderização mudam de um sistema para outro: a comparação só vale dentro
// da imagem oficial do Playwright (pnpm test:visual).
test.skip(!process.env.PLAYWRIGHT_DOCKER, 'regressão visual roda no Docker: pnpm test:visual')

// Capturas estáveis: com movimento reduzido as entradas e as animações de rolagem ficam desligadas.
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// Desktop: os itens do frame do Figma. O frame mobile não mostra itens.
const desktopItems = [
  ['emerald-ape-042', '1-50', 2],
  ['violet-nomad-314', 'open', 6],
  ['ivory-baron-088', 'open', 9],
] as const
const mobileItems = [
  ['emerald-ape-042', '1-50', 1],
  ['ivory-baron-088', '1-10', 2],
] as const

test('regressão visual do pagamento', async ({ page }) => {
  await startCleanMockServer(page)
  const token = await login(page, 'ana@kurio.dev')
  for (const [nftId, editionId, quantity] of isDesktopLayout(page) ? desktopItems : mobileItems) {
    await callApi(page, 'POST', '/api/cart/items', { token, body: { nftId, editionId, quantity } })
  }
  await page.evaluate((value) => localStorage.setItem('kurio:token', value), token)

  await page.goto('/pagamento')
  await expect(page.getByTestId('checkout-total')).toBeVisible()
  await page.evaluate(async () => {
    for (const image of document.images) image.loading = 'eager'
    await Promise.all([...document.images].map((image) => image.decode().catch(() => undefined)))
  })
  await page.evaluate(() => document.fonts.ready)

  await expect(page).toHaveScreenshot('pagamento.png', {
    fullPage: true,
    animations: 'disabled',
    mask: [page.getByTestId('realtime-announcement')],
    maxDiffPixelRatio: 0.01,
  })
})
