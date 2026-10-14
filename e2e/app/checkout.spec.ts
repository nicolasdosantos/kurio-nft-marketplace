import { expect, test, type Page } from '@playwright/test'
import { loginThroughUi } from '../support/app'
import { setScenario, startCleanMockServer } from '../support/mock-api'

test.beforeEach(async ({ page }) => {
  await startCleanMockServer(page)
  await loginThroughUi(page, 'ana@kurio.dev')
  await page.goto('/nft/sage-nomad-009')
  await page.getByRole('button', { name: 'Comprar' }).click()
  await expect(page.getByTestId('cart-link')).toHaveText('Carrinho (1)')
})

async function reviewOrder(page: Page) {
  await page.goto('/pagamento')
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(page.getByTestId('wallet-status')).toHaveText('Carteira conectada')
  await page.getByRole('button', { name: 'Revisar pedido' }).click()
}

test('compra do carrinho até o pedido confirmado', async ({ page }) => {
  await reviewOrder(page)
  await expect(page.getByTestId('checkout-total')).toHaveText('1.706 ETH')
  await page.getByRole('button', { name: 'Confirmar compra' }).click()

  await expect(page).toHaveURL(/\/pedidos\/order-/)
  await expect(page.getByTestId('order-status')).toHaveText(/Seus NFTs agora estão na sua carteira/)
  await expect(page.getByText('Transação simulada')).toBeVisible()
  await expect(page.getByTestId('cart-link')).toHaveText('Carrinho (0)')
})

test('preço alterado na hora da compra exige nova confirmação', async ({ page }) => {
  await setScenario(page, 'price-changed-at-checkout')
  await reviewOrder(page)
  await page.getByRole('button', { name: 'Confirmar compra' }).click()

  await expect(page.getByText(/O novo total é 1.806 ETH/)).toBeVisible()
  await expect(page).toHaveURL(/\/pagamento$/)

  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page).toHaveURL(/\/pedidos\/order-/)
})
