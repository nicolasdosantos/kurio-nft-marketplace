import { expect, test, type Page } from '@playwright/test'
import { callApi, login, startCleanMockServer } from '../support/mock-api'

// Fontes e renderização mudam de um sistema para outro: a comparação só vale dentro
// da imagem oficial do Playwright (pnpm test:visual).
test.skip(!process.env.PLAYWRIGHT_DOCKER, 'regressão visual roda no Docker: pnpm test:visual')

async function openAs(page: Page, token: string, path: string) {
  await page.evaluate((value) => localStorage.setItem('kurio:token', value), token)
  await page.goto(path)
  await page.evaluate(() => document.fonts.ready)
}

function screenshot(page: Page, name: string) {
  return expect(page).toHaveScreenshot(name, {
    fullPage: true,
    animations: 'disabled',
    mask: [page.getByTestId('realtime-announcement')],
    maxDiffPixelRatio: 0.01,
  })
}

test('regressão visual do perfil', async ({ page }) => {
  await startCleanMockServer(page)
  await openAs(page, await login(page, 'ana@kurio.dev'), '/perfil')
  await expect(page.getByRole('textbox', { name: 'E-mail', exact: true })).toHaveValue(
    'ana@kurio.dev',
  )
  await screenshot(page, 'perfil.png')
})

// Conta nova, sem carteiras: o mesmo estado do frame do Figma (formulário da principal aberto).
test('regressão visual das carteiras', async ({ page }) => {
  await startCleanMockServer(page)
  const account = await callApi(page, 'POST', '/api/auth/register', {
    body: {
      displayName: 'Carla Dias',
      username: 'carla.dias',
      email: 'carla@kurio.dev',
      password: 'segredo123',
    },
  })
  await openAs(page, account.body.token, '/carteiras')
  await expect(page.getByRole('button', { name: 'Salvar carteira' })).toBeVisible()
  await screenshot(page, 'carteiras.png')
})
