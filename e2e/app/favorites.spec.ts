import { expect, test } from '@playwright/test'
import { loginThroughUi } from '../support/app'
import { callApi, startCleanMockServer, waitForMocks } from '../support/mock-api'

test.beforeEach(async ({ page }) => {
  await startCleanMockServer(page)
})

test('favorito com falha volta ao estado anterior', async ({ page }) => {
  await loginThroughUi(page, 'bruno@kurio.dev')
  await page.goto('/nft/sage-nomad-009')
  const favoriteButton = page.getByRole('button', { name: /Favorit/ })
  await expect(favoriteButton).toHaveText('Favoritar')

  await callApi(page, 'POST', '/api/mock-control/faults', {
    body: { method: 'PUT', path: '/api/favorites/:nftId', status: 500 },
  })
  await favoriteButton.click()

  await expect(page.getByText('Não foi possível atualizar o favorito')).toBeVisible()
  await expect(favoriteButton).toHaveText('Favoritar')
  await expect(favoriteButton).toHaveAttribute('aria-pressed', 'false')

  // A UI muda na hora (otimista); só recarrega depois que o servidor confirmou.
  const saved = page.waitForResponse(
    (response) =>
      response.url().includes('/api/favorites/') && response.request().method() === 'PUT',
  )
  await favoriteButton.click()
  await expect(favoriteButton).toHaveText('Favoritado')
  expect((await saved).status()).toBe(204)
  await page.reload()
  await waitForMocks(page)
  await expect(page.getByRole('button', { name: /Favorit/ })).toHaveText('Favoritado')
})
