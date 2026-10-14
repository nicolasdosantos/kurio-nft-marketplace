import { expect, test } from '@playwright/test'
import { loginThroughUi, logoutThroughUi } from '../support/app'
import { callApi, startCleanMockServer, waitForMocks } from '../support/mock-api'

test.beforeEach(async ({ page }) => {
  await startCleanMockServer(page)
})

test('rota protegida manda para o login e volta depois', async ({ page }) => {
  await page.goto('/carteiras')
  await expect(page).toHaveURL(/\/login\?redirect=%2Fcarteiras/)

  await loginThroughUi(page, 'ana@kurio.dev')
  await expect(page).toHaveURL(/\/carteiras$/)
  await expect(page.getByRole('heading', { name: 'Carteiras' })).toBeVisible()
})

test('sessão sobrevive ao refresh', async ({ page }) => {
  await loginThroughUi(page, 'bruno@kurio.dev')
  await page.reload()
  await waitForMocks(page)
  await expect(page.getByTestId('current-user')).toHaveText('Bruno Costa')
})

test('sessão expirada no meio da navegação leva ao login e retoma', async ({ page }) => {
  await loginThroughUi(page, 'ana@kurio.dev')
  await callApi(page, 'POST', '/api/mock-control/expire-sessions')

  await page.getByTestId('current-user').click()
  await expect(page).toHaveURL(/\/login\?.*expired=true/)
  await expect(page.getByText('Sua sessão expirou')).toBeVisible()

  await loginThroughUi(page, 'ana@kurio.dev')
  await expect(page).toHaveURL(/\/perfil$/)
  await expect(page.getByTestId('profile-email')).toHaveText('ana@kurio.dev')
})

test('troca de usuário não deixa nada da Ana para o Bruno', async ({ page }) => {
  await loginThroughUi(page, 'ana@kurio.dev')

  await page.goto('/nft/sage-nomad-009')
  await page.getByRole('button', { name: 'Comprar' }).click()
  await expect(page.getByTestId('cart-link')).toHaveText('Carrinho (1)')

  await page.getByTestId('current-user').click()
  await expect(page.getByTestId('favorite-list')).toContainText('emerald-ape-042')
  await expect(page.getByTestId('order-list')).toContainText('order-ana-0001')

  await logoutThroughUi(page)
  await expect(page.getByTestId('cart-link')).toHaveText('Carrinho (0)')

  await loginThroughUi(page, 'bruno@kurio.dev')
  await expect(page.getByTestId('cart-link')).toHaveText('Carrinho (0)')
  await page.getByTestId('current-user').click()
  await expect(page.getByTestId('profile-email')).toHaveText('bruno@kurio.dev')
  await expect(page.getByTestId('favorite-list')).toHaveText('golden-beat-207')
  await expect(page.getByTestId('order-list')).toBeEmpty()
})
