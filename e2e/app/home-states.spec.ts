import { expect, test } from '@playwright/test'
import { callApi, setScenario, startCleanMockServer } from '../support/mock-api'

test.beforeEach(async ({ page }) => {
  await startCleanMockServer(page)
})

test('skeletons no carregamento lento, sem deslocar o layout', async ({ page }) => {
  await setScenario(page, 'slow')
  await page.reload()

  const skeletons = page.getByTestId('nft-card-skeleton')
  await expect(skeletons).toHaveCount(9)
  const skeletonBox = await skeletons.first().boundingBox()

  const firstCard = page.getByTestId('catalog-results').getByRole('listitem').first()
  await expect(firstCard).toBeVisible({ timeout: 10_000 })
  await expect(skeletons).toHaveCount(0)

  // O card entra com uma subida curta (só transform); mede depois que ela termina.
  await firstCard.evaluate((element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished)),
  )
  // O card ocupa o mesmo espaço do skeleton: nada pula quando os dados chegam.
  const cardBox = await firstCard.boundingBox()
  expect(Math.abs((cardBox?.y ?? 0) - (skeletonBox?.y ?? 0))).toBeLessThanOrEqual(1)
  expect(Math.abs((cardBox?.height ?? 0) - (skeletonBox?.height ?? 0))).toBeLessThanOrEqual(2)
})

test('erro do servidor mostra o aviso e o botão de tentar de novo funciona', async ({ page }) => {
  await setScenario(page, 'server-error')
  await page.reload()

  const errorBox = page.getByRole('alert').filter({ hasText: 'Não foi possível carregar os NFTs' })
  await expect(errorBox).toBeVisible({ timeout: 15_000 })

  await callApi(page, 'PUT', '/api/mock-control/scenario', { body: { name: 'default' } })
  await errorBox.getByRole('button', { name: 'Tentar de novo' }).click()

  await expect(page.getByTestId('catalog-results').getByRole('listitem')).toHaveCount(9)
  await expect(errorBox).toBeHidden()
})

test('estado vazio quando nenhum NFT combina com a busca', async ({ page }) => {
  await page.goto('/?q=nada-com-esse-nome')
  await expect(page.getByText('Nenhum NFT encontrado.')).toBeVisible()
})
