import { expect, test, type Page } from '@playwright/test'
import { expectCartCount, isDesktopLayout } from '../support/app'
import { callApi, setScenario, startCleanMockServer } from '../support/mock-api'

// Sage Nomad #009: 1/1 com 1, 1/10 com 9, 1/50 com 49 e Aberta com 999 (máximo 20 por pedido).
const SAGE = '/nft/sage-nomad-009'

function changeSage(page: Page, body: Record<string, unknown>) {
  return callApi(page, 'POST', '/api/mock-control/nfts/sage-nomad-009', { body })
}

function edition(page: Page, label: string) {
  // O nome acessível é "1/1 , esgotada" ou "1/10 , 9 disponíveis"; a vírgula separa 1/1 de 1/10.
  return page.getByRole('radio', { name: new RegExp(`^${label}\\s*,`) })
}

// O rádio é invisível (sr-only): o usuário clica no pill, que é o rótulo dele.
async function chooseEdition(page: Page, label: string) {
  await edition(page, label).locator('xpath=..').click()
  await expect(edition(page, label)).toBeChecked()
}

async function openSage(page: Page) {
  await page.goto(SAGE)
  await expect(page.getByRole('heading', { level: 1, name: 'Sage Nomad #009' })).toBeVisible()
}

async function expectFocusVisible(page: Page) {
  const outline = await page.evaluate(() => {
    const element = document.activeElement
    // O rádio é invisível (sr-only); o anel de foco aparece no pill logo depois dele.
    const target = element instanceof HTMLInputElement ? element.nextElementSibling : element
    return target ? getComputedStyle(target).outlineStyle : 'none'
  })
  expect(outline).not.toBe('none')
}

test.beforeEach(async ({ page }) => {
  await startCleanMockServer(page)
})

test('edição esgotada fica desabilitada e o estoque aparece', async ({ page }) => {
  // Emerald Ape #042 nasce com 1/1 e 1/10 esgotadas.
  await page.goto('/nft/emerald-ape-042')
  await expect(edition(page, '1/1')).toBeDisabled()
  await expect(edition(page, '1/10')).toBeDisabled()
  await expect(edition(page, '1/50')).toBeChecked()
  await expect(page.getByTestId('edition-stock')).toHaveText('50 disponíveis · até 10 por pedido')
})

test('seletor de edição, stepper e botões pelo teclado, com foco visível', async ({ page }) => {
  test.skip(!isDesktopLayout(page), 'no mobile o stepper fica na barra de compra, longe no tab')
  await openSage(page)

  await edition(page, '1/1').focus()
  await page.keyboard.press('ArrowRight')
  await expect(edition(page, '1/10')).toBeChecked()
  await expect(edition(page, '1/10')).toBeFocused()
  await expectFocusVisible(page)

  // "Diminuir" começa desabilitado com 1, então o Tab vai direto para "Aumentar".
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Aumentar quantidade' })).toBeFocused()
  await expectFocusVisible(page)
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('quantity')).toHaveText('2')

  await page.keyboard.press('Shift+Tab')
  await expect(page.getByRole('button', { name: 'Diminuir quantidade' })).toBeFocused()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  const buy = page.getByRole('button', { name: 'Comprar' })
  await expect(buy).toBeFocused()
  await expectFocusVisible(page)
  await page.keyboard.press('Enter')

  await expect(page.getByTestId('detail-status')).toContainText(
    'Adicionado ao carrinho: 2 × Sage Nomad #009, edição 1/10.',
  )
  await expectCartCount(page, 2)
})

test('quantidade não passa do estoque e o carrinho recusa o que falta', async ({ page }) => {
  await openSage(page)
  await changeSage(page, { editionId: '1-50', stock: 3 })
  await chooseEdition(page, '1/50')
  await expect(page.getByTestId('edition-stock')).toHaveText('3 disponíveis · até 10 por pedido')

  const increase = page.getByRole('button', { name: 'Aumentar quantidade' })
  await increase.click()
  await increase.click()
  await expect(page.getByTestId('quantity')).toHaveText('3')
  await expect(increase).toBeDisabled()

  await page.getByRole('button', { name: 'Comprar' }).click()
  await expect(page.getByTestId('detail-status')).toContainText('Adicionado ao carrinho: 3 ×')
  await expectCartCount(page, 3)

  // Com as 3 no carrinho, mais 1 passa do estoque: o servidor responde OUT_OF_STOCK.
  const decrease = page.getByRole('button', { name: 'Diminuir quantidade' })
  await decrease.click()
  await decrease.click()
  await page.getByRole('button', { name: 'Comprar' }).click()
  await expect(page.getByRole('alert')).toContainText(
    'Estoque insuficiente: seu carrinho já tem todo o estoque da edição 1/50.',
  )
  await expectCartCount(page, 3)
})

test('preço e estoque mudam pelo socket com a tela aberta', async ({ page }) => {
  await openSage(page)
  await expect(page.getByTestId('socket-status')).toHaveText('conectado')

  await chooseEdition(page, '1/10')
  const increase = page.getByRole('button', { name: 'Aumentar quantidade' })
  for (let click = 0; click < 3; click++) await increase.click()
  await expect(page.getByTestId('quantity')).toHaveText('4')

  // O estoque cai abaixo da quantidade escolhida: a quantidade é ajustada e avisada.
  await changeSage(page, { editionId: '1-10', stock: 2 })
  await expect(page.getByTestId('quantity')).toHaveText('2')
  await expect(page.getByTestId('detail-status')).toHaveText(
    'O estoque da edição 1/10 mudou. A quantidade foi ajustada para 2.',
  )

  // A edição escolhida esgota: a seleção vai para a primeira disponível.
  await changeSage(page, { editionId: '1-10', stock: 0 })
  await expect(edition(page, '1/10')).toBeDisabled()
  await expect(edition(page, '1/1')).toBeChecked()
  await expect(page.getByTestId('detail-status')).toHaveText(
    'A edição 1/10 esgotou. Selecionamos a edição 1/1.',
  )

  await changeSage(page, { priceEth: '2.00' })
  await expect(page.getByTestId('nft-price')).toContainText('2.00 ETH')
  await expect(page.getByTestId('detail-status')).toHaveText('O preço mudou para 2.00 ETH.')
})

test('skeleton no carregamento lento ocupa o lugar da imagem, sem deslocar', async ({ page }) => {
  await setScenario(page, 'slow')
  await page.goto(SAGE)

  const skeletonImage = page.getByTestId('skeleton-main-image')
  await expect(skeletonImage).toBeVisible()
  const skeletonBox = await skeletonImage.boundingBox()

  const image = page.getByTestId('gallery-main')
  await expect(image).toBeVisible({ timeout: 10_000 })
  await expect(skeletonImage).toHaveCount(0)
  // No desktop a imagem tem 16px de moldura dentro da caixa do skeleton.
  const inset = isDesktopLayout(page) ? 16 : 0
  const imageBox = await image.boundingBox()
  expect(Math.abs((imageBox?.x ?? 0) - inset - (skeletonBox?.x ?? 0))).toBeLessThanOrEqual(1)
  expect(Math.abs((imageBox?.y ?? 0) - inset - (skeletonBox?.y ?? 0))).toBeLessThanOrEqual(1)
})

test('erro ao carregar mostra o aviso e tentar de novo recupera', async ({ page }) => {
  await setScenario(page, 'server-error')
  await page.goto(SAGE)

  await expect(page.getByRole('heading', { name: 'Não foi possível carregar o NFT' })).toBeVisible({
    timeout: 15_000,
  })

  await callApi(page, 'PUT', '/api/mock-control/scenario', { body: { name: 'default' } })
  await page.getByRole('button', { name: 'Tentar de novo' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Sage Nomad #009' })).toBeVisible()
})
