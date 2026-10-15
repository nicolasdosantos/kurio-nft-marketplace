import { expect, test } from '@playwright/test'
import { closeFiltersIfOpen, openFiltersIfNeeded, searchCatalog } from '../support/app'
import { setScenario, startCleanMockServer, waitForMocks } from '../support/mock-api'

test.beforeEach(async ({ page }) => {
  await startCleanMockServer(page)
})

test('filtros ficam na URL e voltam com o histórico', async ({ page }) => {
  const results = page.getByTestId('catalog-results')
  await expect(results.getByRole('listitem')).toHaveCount(9)

  await openFiltersIfNeeded(page)
  await page.getByRole('checkbox', { name: /Música/ }).check()
  await expect(page).toHaveURL(/collections/)
  await page.getByRole('checkbox', { name: /Ethereum/ }).check()
  await expect(page).toHaveURL(/networks/)
  await closeFiltersIfOpen(page)
  await expect(results.getByRole('listitem')).toHaveCount(2)
  await expect(results).toContainText('Golden Beat #207')

  await page.reload()
  await waitForMocks(page)
  await openFiltersIfNeeded(page)
  await expect(page.getByRole('checkbox', { name: /Ethereum/ })).toBeChecked()
  await closeFiltersIfOpen(page)
  await expect(results.getByRole('listitem')).toHaveCount(2)

  await page.goBack()
  await openFiltersIfNeeded(page)
  await expect(page.getByRole('checkbox', { name: /Ethereum/ })).not.toBeChecked()
  await expect(page.getByRole('checkbox', { name: /Música/ })).toBeChecked()
  await closeFiltersIfOpen(page)
  await expect(results.getByRole('listitem')).toHaveCount(6)

  await page.goForward()
  await openFiltersIfNeeded(page)
  await expect(page.getByRole('checkbox', { name: /Ethereum/ })).toBeChecked()
  await closeFiltersIfOpen(page)
  await expect(results.getByRole('listitem')).toHaveCount(2)
})

test('mudar a ordenação volta para a página 1', async ({ page }) => {
  await page.getByRole('link', { name: 'Página 2' }).click()
  await expect(page).toHaveURL(/page=2/)

  // No mobile a ordenação fica dentro do Sheet de filtros.
  if ((page.viewportSize()?.width ?? 0) < 768) await openFiltersIfNeeded(page)
  await page.getByRole('combobox', { name: 'Ordenar por:' }).filter({ visible: true }).click()
  await page.getByRole('option', { name: 'Menor preço' }).click()

  await expect(page).not.toHaveURL(/page=/)
  await closeFiltersIfOpen(page)
  await expect(page.getByTestId('catalog-results').getByRole('listitem').first()).toContainText(
    '0.02 ETH',
  )
})

test('resposta antiga não sobrescreve a busca mais recente', async ({ page }) => {
  await setScenario(page, 'out-of-order')
  await page.reload()
  await waitForMocks(page)

  // A listagem inicial demora 1,5s; a busca logo em seguida responde em 150ms.
  await searchCatalog(page, 'emerald')

  const results = page.getByTestId('catalog-results')
  await expect(results.getByRole('listitem').first()).toContainText('Emerald')

  // Espera a resposta lenta chegar e confere que nada mudou.
  await page.waitForTimeout(2000)
  for (const name of await results.getByRole('heading').allTextContents()) {
    expect(name).toContain('Emerald')
  }
  await expect(page).toHaveURL(/q=emerald/)
})
