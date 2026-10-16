import { expect, test, type Locator, type Page } from '@playwright/test'
import { expectFocusVisible } from '../support/app'
import { callApi, startCleanMockServer } from '../support/mock-api'

// Só teclado: o locator serve para conferir onde o foco está, nunca para clicar.
async function tabTo(page: Page, target: Locator, maxTabs = 80) {
  for (let presses = 0; presses < maxTabs; presses += 1) {
    if (await target.evaluate((element) => element === document.activeElement).catch(() => false)) {
      await expectFocusVisible(page)
      return
    }
    await page.keyboard.press('Tab')
  }
  throw new Error(`O foco não chegou em ${target} depois de ${maxTabs} Tabs`)
}

test('compra completa só pelo teclado, do catálogo ao recibo', async ({ page }) => {
  test.setTimeout(90_000)
  await startCleanMockServer(page)
  await page.goto('/')
  await expect(page.getByTestId('catalog-results').locator('li').first()).toBeVisible()

  // Catálogo -> detalhe do primeiro NFT.
  const firstCard = page.getByTestId('catalog-results').locator('li').first()
  const nftName = (await firstCard.getByRole('heading').innerText()).trim()
  await tabTo(page, firstCard.getByRole('link').first())
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: nftName })).toBeVisible()

  // Detalhe -> carrinho.
  await tabTo(page, page.getByRole('button', { name: 'Comprar' }))
  await page.keyboard.press('Enter')
  const goToCart = page.getByRole('link', { name: 'Ver carrinho', exact: true })
  await expect(goToCart).toBeVisible()
  await tabTo(page, goToCart)
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/carrinho$/)
  await expect(page.getByTestId('cart-total')).toBeVisible()

  // Carrinho -> login (visitante) -> pagamento.
  await tabTo(page, page.getByRole('link', { name: 'Conectar e finalizar' }))
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/login/)
  const email = page.getByLabel('E-mail', { exact: true })
  await tabTo(page, email)
  await page.keyboard.type('ana@kurio.dev')
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Senha', { exact: true })).toBeFocused()
  await page.keyboard.type('kurio123')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/pagamento$/)
  await expect(page.getByTestId('checkout-items')).toContainText(nftName)

  // Pagamento: conectar a carteira e confirmar.
  await tabTo(page, page.getByRole('button', { name: /^Conectar( carteira)?$/ }))
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('wallet-status')).toHaveText('Carteira conectada')
  await tabTo(page, page.getByRole('button', { name: 'Confirmar compra' }))
  await page.keyboard.press('Enter')

  // Recibo confirmado.
  await expect(page).toHaveURL(/\/pedidos\/order-/, { timeout: 15_000 })
  await expect(page.getByTestId('order-status')).toHaveText('Seus NFTs agora estão na sua carteira')
  const receipt = page.getByRole('region', { name: 'Recibo' })
  await expect(receipt.getByTestId('receipt-items')).toContainText(nftName)

  // E o caminho de volta ao catálogo, também pelo teclado.
  await tabTo(page, receipt.getByRole('link', { name: 'Voltar ao catálogo' }))
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/$/)

  const token = await page.evaluate(() => localStorage.getItem('kurio:token') ?? '')
  const orders = await callApi(page, 'GET', '/api/orders', { token })
  expect((orders.body as { id: string }[]).filter((o) => o.id !== 'order-ana-0001')).toHaveLength(1)
})
