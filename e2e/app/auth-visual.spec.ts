import { expect, test } from '@playwright/test'
import { isDesktopLayout } from '../support/app'
import { startCleanMockServer } from '../support/mock-api'

// Fontes e renderização mudam de um sistema para outro: a comparação só vale dentro
// da imagem oficial do Playwright (pnpm test:visual).
test.skip(!process.env.PLAYWRIGHT_DOCKER, 'regressão visual roda no Docker: pnpm test:visual')

const screens = [
  { path: '/login', name: 'login', firstField: '#login-email' },
  { path: '/cadastro', name: 'cadastro', firstField: '#register-username' },
]

for (const screen of screens) {
  test(`regressão visual do ${screen.name}`, async ({ page }) => {
    await startCleanMockServer(page)
    await page.goto(screen.path)
    await expect(page.locator(screen.firstField)).toBeVisible({ timeout: 10_000 })
    if (isDesktopLayout(page)) {
      // O Início aparece atrás do modal: espera o catálogo carregar.
      await expect(page.getByTestId('catalog-results').locator('li')).toHaveCount(9)
    }
    await page.evaluate(async () => {
      for (const image of document.images) image.loading = 'eager'
      await Promise.all([...document.images].map((image) => image.decode().catch(() => undefined)))
    })
    await page.evaluate(() => document.fonts.ready)

    // Desktop: a tela visível com o modal; mobile: a página inteira.
    await expect(page).toHaveScreenshot(`${screen.name}.png`, {
      fullPage: !isDesktopLayout(page),
      animations: 'disabled',
      mask: [page.getByTestId('realtime-announcement')],
      maxDiffPixelRatio: 0.01,
    })
  })
}
