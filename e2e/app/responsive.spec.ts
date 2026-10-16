import { test } from '@playwright/test'
import {
  expectCartCount,
  expectNoHorizontalScroll,
  isDesktopLayout,
  loginThroughUi,
} from '../support/app'
import { callApi, orderBody, prepareCheckout, startCleanMockServer } from '../support/mock-api'

test('todas as telas sem rolagem horizontal', async ({ page }) => {
  test.setTimeout(120_000)
  await startCleanMockServer(page)
  await loginThroughUi(page, 'ana@kurio.dev')
  const token = await page.evaluate(() => localStorage.getItem('kurio:token') ?? '')
  const quote = await prepareCheckout(page, token)
  const order = await callApi(page, 'POST', '/api/orders', {
    token,
    idempotencyKey: crypto.randomUUID(),
    body: orderBody(quote.id),
  })
  await page.goto('/nft/sage-nomad-009')
  await page.getByRole('button', { name: 'Comprar' }).click()
  await expectCartCount(page, 1)

  const screens: [string, string, string][] = [
    ['Início', '/', 'catalog-results'],
    ['Início filtrado', '/?tab=trending&sort=price-asc&networks=ethereum', 'catalog-results'],
    ['Detalhe', '/nft/emerald-ape-042', 'nft-price'],
    ['Carrinho', '/carrinho', 'cart-total'],
    ['Pagamento', '/pagamento', 'checkout-total'],
    ['Comprovante', `/pedidos/${order.body.id}`, 'order-status'],
    ['Perfil', '/perfil', 'profile-status'],
    ['Carteiras', '/carteiras', 'primary-wallet-card'],
  ]
  const widths = isDesktopLayout(page) ? [768, 1440] : [320, 390]

  for (const width of widths) {
    await page.setViewportSize({ width, height: isDesktopLayout(page) ? 900 : 844 })
    for (const [screen, path, testId] of screens) {
      await page.goto(path)
      await page.getByTestId(testId).first().waitFor({ state: 'attached' })
      await page.waitForTimeout(300)
      await expectNoHorizontalScroll(page, width, screen)
    }
  }

  // Telas de visitante: login, cadastro, NFT inexistente e rota inexistente.
  await page.evaluate(() => localStorage.removeItem('kurio:token'))
  for (const width of widths) {
    await page.setViewportSize({ width, height: isDesktopLayout(page) ? 900 : 844 })
    const visitorScreens: [string, string, string][] = [
      ['Login', '/login', 'Esqueceu a senha?'],
      ['Cadastro', '/cadastro', 'Confirmar senha'],
      ['NFT inexistente', '/nft/nao-existe', 'não encontrado'],
      ['Página não encontrada', '/rota-que-nao-existe', 'Página não encontrada'],
    ]
    for (const [screen, path, text] of visitorScreens) {
      await page.goto(path)
      await page.getByText(text).first().waitFor()
      await page.waitForTimeout(300)
      await expectNoHorizontalScroll(page, width, screen)
    }
  }
})
