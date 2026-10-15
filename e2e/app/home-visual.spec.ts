import { expect, test } from '@playwright/test'
import { startCleanMockServer } from '../support/mock-api'

// Fontes e renderização mudam de um sistema para outro: a comparação só vale dentro
// da imagem oficial do Playwright (pnpm test:visual).
test.skip(!process.env.PLAYWRIGHT_DOCKER, 'regressão visual roda no Docker: pnpm test:visual')

test('regressão visual do Início', async ({ page }) => {
  await startCleanMockServer(page)
  await page.reload()
  await expect(page.getByTestId('catalog-results').getByRole('listitem')).toHaveCount(9)
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)

  await expect(page).toHaveScreenshot('inicio.png', {
    fullPage: true,
    animations: 'disabled',
    // O indicador de conexão do socket não aparece na tela, mas evita qualquer variação.
    mask: [page.getByTestId('realtime-announcement')],
    maxDiffPixelRatio: 0.01,
  })
})
