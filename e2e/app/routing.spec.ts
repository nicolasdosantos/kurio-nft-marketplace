import { expect, test } from '@playwright/test'
import { startCleanMockServer } from '../support/mock-api'

test.beforeEach(async ({ page }) => {
  await startCleanMockServer(page)
})

test('acesso direto e refresh em rotas internas', async ({ page }) => {
  await page.goto('/nft/emerald-ape-042')
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()

  await page.goto('/carrinho')
  await expect(page.getByRole('heading', { name: 'Carrinho' })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
})

test('rota inexistente e NFT inexistente', async ({ page }) => {
  await page.goto('/essa/rota/nao/existe')
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()

  await page.goto('/nft/nft-que-nao-existe')
  await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()
})
