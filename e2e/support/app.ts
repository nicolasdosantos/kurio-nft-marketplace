import { expect, type Page } from '@playwright/test'

export async function loginThroughUi(page: Page, email: string) {
  if (!page.url().includes('/login')) {
    await page.goto('/login')
  }
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill('kurio123')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByTestId('current-user')).toBeVisible()
  // Espera as buscas do novo usuário terminarem antes de o teste seguir.
  await page.waitForLoadState('networkidle')
}

export async function logoutThroughUi(page: Page) {
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
}
