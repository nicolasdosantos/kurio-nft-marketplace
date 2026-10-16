import { expect, test, type Page } from '@playwright/test'
import { expectFocusVisible, isDesktopLayout, loginThroughUi } from '../support/app'
import {
  callApi,
  orderBody,
  prepareCheckout,
  setScenario,
  startCleanMockServer,
} from '../support/mock-api'

function sessionToken(page: Page) {
  return page.evaluate(() => localStorage.getItem('kurio:token') ?? '')
}

// Pedido da Ana pela API: 2x Emerald Ape #042 (edição 1/50), carteira principal, Ethereum.
async function createOrder(page: Page) {
  const token = await sessionToken(page)
  const quote = await prepareCheckout(page, token)
  const order = await callApi(page, 'POST', '/api/orders', {
    token,
    idempotencyKey: crypto.randomUUID(),
    body: orderBody(quote.id),
  })
  expect(order.status).toBe(201)
  return order.body as { id: string; receipt: { transactionHash: string } }
}

// O pedido se resolve 2s depois de criado; a leitura pela API já devolve o desfecho.
async function waitForOrderStatus(page: Page, orderId: string, status: string) {
  const token = await sessionToken(page)
  await expect
    .poll(async () => (await callApi(page, 'GET', `/api/orders/${orderId}`, { token })).body.status)
    .toBe(status)
}

function receipt(page: Page) {
  return page.getByRole('region', { name: 'Recibo' })
}

test.beforeEach(async ({ page }) => {
  await startCleanMockServer(page)
  await loginThroughUi(page, 'ana@kurio.dev')
})

test('acesso direto e refresh no pedido confirmado mostram o recibo completo', async ({ page }) => {
  const order = await createOrder(page)
  await waitForOrderStatus(page, order.id, 'confirmed')

  for (const visit of ['direto', 'refresh']) {
    if (visit === 'direto') await page.goto(`/pedidos/${order.id}`)
    else await page.reload()

    await expect(page.getByTestId('order-status')).toHaveText(
      'Seus NFTs agora estão na sua carteira',
    )
    const box = receipt(page)
    await expect(box.getByTestId('receipt-hash')).toHaveText(order.receipt.transactionHash)
    await expect(box.getByTestId('receipt-date')).toHaveText(/^\d{1,2} \w{3}, \d{4}$/)
    await expect(box).toContainText('MetaMask')
    await expect(box).toContainText('Transação confirmada na Ethereum')
    await expect(box.getByTestId('receipt-items')).toContainText('Emerald Ape #042')
    await expect(box.getByTestId('receipt-items')).toContainText('Edição 1/50')
    await expect(box.getByTestId('receipt-items')).toContainText('(x 2)')
    await expect(box.getByTestId('receipt-items')).toContainText('2.38 ETH')
    await expect(box).toContainText('Subtotal2.38 ETH')
    await expect(box).toContainText('Desconto(-) 0 ETH')
    await expect(box.getByTestId('receipt-fee')).toHaveText('0.016 ETH')
    await expect(box.getByTestId('receipt-total')).toHaveText('2.396 ETH')
    // No lugar do link do Etherscan, o aviso de que a transação é simulada.
    await expect(box.getByRole('note')).toContainText('Transação simulada')
    await expect(page.getByRole('link', { name: /Etherscan/ })).toHaveCount(0)
  }
})

test('pedido pendente continua pendente no refresh e atualiza ao ser confirmado', async ({
  page,
}) => {
  await setScenario(page, 'payment-pending')
  const order = await createOrder(page)

  await page.goto(`/pedidos/${order.id}`)
  await expect(page.getByTestId('order-status')).toHaveText('Pagamento pendente')
  await expect(receipt(page).getByRole('status')).toContainText('Aguardando a confirmação')
  await page.reload()
  await expect(page.getByTestId('order-status')).toHaveText('Pagamento pendente')
  await expect(receipt(page).getByTestId('receipt-total')).toHaveText('2.396 ETH')

  // A rede confirma: o order.updated chega pelo socket e a tela muda sozinha.
  await expect(page.getByTestId('socket-status')).toHaveText('conectado')
  await callApi(page, 'POST', `/api/mock-control/orders/${order.id}/settle`)
  await expect(page.getByTestId('order-status')).toHaveText('Seus NFTs agora estão na sua carteira')
  await page.reload()
  await expect(page.getByTestId('order-status')).toHaveText('Seus NFTs agora estão na sua carteira')
})

test('pedido recusado mostra o motivo e o caminho de volta, também após refresh', async ({
  page,
}) => {
  await setScenario(page, 'payment-declined')
  const order = await createOrder(page)
  await waitForOrderStatus(page, order.id, 'declined')

  await page.goto(`/pedidos/${order.id}`)
  for (let visit = 0; visit < 2; visit += 1) {
    if (visit === 1) await page.reload()
    await expect(page.getByTestId('order-status')).toHaveText('Pagamento recusado')
    await expect(receipt(page)).toContainText('A carteira recusou o pagamento')
    await expect(receipt(page)).not.toContainText('Transação confirmada')
  }
  await receipt(page).getByRole('link', { name: 'Voltar ao carrinho' }).click()
  await expect(page).toHaveURL(/\/carrinho$/)
  await expect(page.getByTestId('cart-items')).toContainText('Emerald Ape #042')
})

test('o recibo não muda quando o preço do NFT muda depois da compra', async ({ page }) => {
  const order = await createOrder(page)
  await waitForOrderStatus(page, order.id, 'confirmed')

  await callApi(page, 'POST', '/api/mock-control/nfts/emerald-ape-042', {
    body: { priceEth: '9.99' },
  })
  const nft = await callApi(page, 'GET', '/api/nfts/emerald-ape-042')
  expect(nft.body.priceEth).toBe('9.99')

  await page.goto(`/pedidos/${order.id}`)
  await expect(receipt(page).getByTestId('receipt-items')).toContainText('2.38 ETH')
  await expect(receipt(page)).toContainText('Subtotal2.38 ETH')
  await expect(receipt(page).getByTestId('receipt-total')).toHaveText('2.396 ETH')
  await expect(receipt(page)).not.toContainText('9.99')
})

test('o Bruno não consegue abrir o pedido da Ana', async ({ page }) => {
  // order-ana-0001 é o pedido antigo da Ana nas fixtures.
  await page.goto('/')
  await page.evaluate(() => localStorage.removeItem('kurio:token'))
  await loginThroughUi(page, 'bruno@kurio.dev')

  const response = await callApi(page, 'GET', '/api/orders/order-ana-0001', {
    token: await sessionToken(page),
  })
  expect(response.status).toBe(403)

  await page.goto('/pedidos/order-ana-0001')
  await expect(page.getByRole('heading', { name: 'Este pedido é de outra conta' })).toBeVisible()
  await expect(receipt(page)).toHaveCount(0)
  await expect(page.getByText('Ana Ribeiro')).toHaveCount(0)
})

test('modal do comprovante: foco preso, Esc devolve o foco e volta ao catálogo', async ({
  page,
}) => {
  test.skip(!isDesktopLayout(page), 'no mobile o comprovante é uma página, não um modal')
  const order = await createOrder(page)
  await waitForOrderStatus(page, order.id, 'confirmed')
  await page.goto(`/pedidos/${order.id}`)

  const dialog = page.getByRole('dialog', { name: 'Seus NFTs agora estão na sua carteira' })
  await expect(dialog).toBeVisible()
  const focusInDialog = () => dialog.evaluate((element) => element.contains(document.activeElement))
  expect(await focusInDialog()).toBe(true)

  // Tab e Shift+Tab várias vezes: o foco nunca sai do modal.
  for (const key of ['Tab', 'Tab', 'Tab', 'Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab']) {
    await page.keyboard.press(key)
    expect(await focusInDialog()).toBe(true)
  }

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  const reopen = page.getByRole('button', { name: 'Ver comprovante' })
  await expect(reopen).toBeFocused()
  await expectFocusVisible(page)

  await page.keyboard.press('Enter')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Fechar' }).focus()
  await page.keyboard.press('Enter')
  await expect(dialog).toBeHidden()
  await expect(reopen).toBeFocused()

  await reopen.press('Enter')
  const backToCatalog = dialog.getByRole('link', { name: 'Voltar ao catálogo' })
  await backToCatalog.focus()
  await expectFocusVisible(page)
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByTestId('catalog-results')).toBeVisible()
})

test('no mobile o comprovante é uma página com volta ao catálogo', async ({ page }) => {
  test.skip(isDesktopLayout(page), 'no desktop o comprovante é um modal')
  const order = await createOrder(page)
  await waitForOrderStatus(page, order.id, 'confirmed')
  await page.goto(`/pedidos/${order.id}`)

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Seus NFTs agora estão na sua carteira',
  )
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('link', { name: 'Voltar ao catálogo' }).first().click()
  await expect(page).toHaveURL(/\/$/)
})
