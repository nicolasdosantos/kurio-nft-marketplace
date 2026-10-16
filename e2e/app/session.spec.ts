import { expect, test } from '@playwright/test'
import {
  expectCartCount,
  isDesktopLayout,
  loginThroughUi,
  logoutThroughUi,
  openProfile,
  profileEmail,
} from '../support/app'
import { callApi, startCleanMockServer, waitForMocks } from '../support/mock-api'

test.beforeEach(async ({ page }) => {
  await startCleanMockServer(page)
})

test('rota protegida manda para o login e volta depois', async ({ page }) => {
  await page.goto('/carteiras')
  await expect(page).toHaveURL(/\/login\?redirect=%2Fcarteiras/)

  await loginThroughUi(page, 'ana@kurio.dev')
  await expect(page).toHaveURL(/\/carteiras$/)
  await expect(page.getByRole('heading', { name: 'Carteira principal' })).toBeVisible()
})

test('sessão sobrevive ao refresh', async ({ page }) => {
  await loginThroughUi(page, 'bruno@kurio.dev')
  await page.reload()
  await waitForMocks(page)
  await openProfile(page)
  await expect(profileEmail(page)).toHaveValue('bruno@kurio.dev')
})

test('sessão expirada no meio da navegação leva ao login e retoma', async ({ page }) => {
  await loginThroughUi(page, 'ana@kurio.dev')
  await callApi(page, 'POST', '/api/mock-control/expire-sessions')

  if (isDesktopLayout(page)) {
    await page.getByTestId('current-user').click()
    await page.getByRole('menuitem', { name: 'Dados do perfil' }).click()
  } else {
    await page.getByRole('link', { name: 'Minha conta' }).click()
  }
  await expect(page).toHaveURL(/\/login\?.*expired=true/)
  await expect(page.getByText('Sua sessão expirou')).toBeVisible()

  await loginThroughUi(page, 'ana@kurio.dev')
  await expect(page).toHaveURL(/\/perfil$/)
  await expect(profileEmail(page)).toHaveValue('ana@kurio.dev')
})

test('troca de usuário não deixa nada da Ana para o Bruno', async ({ page }) => {
  await loginThroughUi(page, 'ana@kurio.dev')

  await page.goto('/nft/sage-nomad-009')
  await page.getByRole('button', { name: 'Comprar' }).click()
  await expectCartCount(page, 1)

  await page.goto('/')
  await expect(
    page.getByRole('button', { name: 'Remover Emerald Ape #042 dos favoritos' }),
  ).toBeVisible()
  await openProfile(page)
  await expect(profileEmail(page)).toHaveValue('ana@kurio.dev')

  await logoutThroughUi(page)
  await expectCartCount(page, 0)

  await loginThroughUi(page, 'bruno@kurio.dev')
  await expectCartCount(page, 0)
  await expect(page.getByRole('button', { name: 'Favoritar Emerald Ape #042' })).toBeVisible()
  await openProfile(page)
  await expect(profileEmail(page)).toHaveValue('bruno@kurio.dev')
})
