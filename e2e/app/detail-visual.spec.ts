import { expect, test } from '@playwright/test'
import { startCleanMockServer } from '../support/mock-api'

// Fontes e renderização mudam de um sistema para outro: a comparação só vale dentro
// da imagem oficial do Playwright (pnpm test:visual).
test.skip(!process.env.PLAYWRIGHT_DOCKER, 'regressão visual roda no Docker: pnpm test:visual')

// Capturas estáveis: com movimento reduzido as entradas e as animações de rolagem ficam desligadas.
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test('regressão visual do detalhe', async ({ page }) => {
  await startCleanMockServer(page)
  await page.goto('/nft/emerald-ape-042')
  await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Mais desta coleção' })).toBeVisible()
  const related = page.getByRole('region', { name: 'Mais desta coleção' })
  // 4 cards no desktop, 2 por página no mobile: basta o primeiro ter chegado.
  await expect(related.getByRole('link').first()).toBeVisible()

  // As imagens abaixo da dobra são lazy; na captura de página inteira todas precisam estar lá.
  await page.evaluate(async () => {
    for (const image of document.images) image.loading = 'eager'
    await Promise.all([...document.images].map((image) => image.decode().catch(() => undefined)))
  })
  await page.evaluate(() => document.fonts.ready)

  await expect(page).toHaveScreenshot('detalhe.png', {
    fullPage: true,
    animations: 'disabled',
    mask: [page.getByTestId('realtime-announcement')],
    maxDiffPixelRatio: 0.01,
  })
})
