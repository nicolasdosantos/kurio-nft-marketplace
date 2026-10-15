import { expect, test, type Locator, type Page } from '@playwright/test'
import { isDesktopLayout } from '../support/app'
import { startCleanMockServer } from '../support/mock-api'

async function tabUntilFocused(page: Page, target: Locator, maxPresses = 60) {
  for (let press = 0; press < maxPresses; press++) {
    await page.keyboard.press('Tab')
    if (await target.evaluate((element) => element === document.activeElement)) return
  }
  throw new Error('o elemento não recebeu foco pelo teclado')
}

// Foco visível pode vir de outline (padrão do app) ou de anel com box-shadow (componentes do shadcn).
async function expectVisibleFocus(target: Locator) {
  const focusStyle = await target.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      hasOutline: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0,
      hasRing: style.boxShadow !== 'none',
    }
  })
  expect(focusStyle.hasOutline || focusStyle.hasRing).toBe(true)
}

test.beforeEach(async ({ page }) => {
  await startCleanMockServer(page)
  await expect(page.getByTestId('catalog-results').getByRole('listitem')).toHaveCount(9)
})

test('pular para o conteúdo é o primeiro item do teclado', async ({ page }) => {
  await page.keyboard.press('Tab')
  const skipLink = page.getByRole('link', { name: 'Pular para o conteúdo' })
  await expect(skipLink).toBeFocused()
  await expect(skipLink).toBeVisible()
})

test('header, filtros e cards funcionam pelo teclado com foco visível', async ({ page }) => {
  test.skip(!isDesktopLayout(page), 'header e sidebar são do layout desktop')

  const searchButton = page.getByRole('button', { name: 'Abrir busca' })
  await tabUntilFocused(page, searchButton)
  await expectVisibleFocus(searchButton)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('searchbox', { name: 'Buscar NFTs' })).toBeFocused()
  await page.keyboard.press('Escape')

  const musicFilter = page.getByRole('checkbox', { name: /Música/ })
  await tabUntilFocused(page, musicFilter)
  await expectVisibleFocus(musicFilter)
  await page.keyboard.press('Space')
  await expect(page).toHaveURL(/collections/)

  const firstCardLink = page.getByTestId('catalog-results').getByRole('link').first()
  await tabUntilFocused(page, firstCardLink)
  await expectVisibleFocus(firstCardLink)
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/nft\//)
})

test('filtros no Sheet prendem o foco e fecham com Esc no mobile', async ({ page }) => {
  test.skip(isDesktopLayout(page), 'o Sheet de filtros é do layout mobile')

  const openButton = page.getByRole('button', { name: 'Abrir filtros' }).filter({ visible: true })
  await openButton.focus()
  await page.keyboard.press('Enter')

  const sheet = page.getByRole('dialog', { name: 'Filtros' })
  await expect(sheet).toBeVisible()
  for (let press = 0; press < 30; press++) {
    await page.keyboard.press('Tab')
    expect(await sheet.evaluate((element) => element.contains(document.activeElement))).toBe(true)
  }

  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
  await expect(openButton).toBeFocused()
})
