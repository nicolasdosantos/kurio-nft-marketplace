import { expect, test, type Page } from '@playwright/test'
import { expectCartCount, expectFocusVisible, loginThroughUi } from '../support/app'
import { callApi, setScenario, startCleanMockServer } from '../support/mock-api'

function sessionToken(page: Page) {
  return page.evaluate(() => localStorage.getItem('kurio:token') ?? '')
}

// Pedidos da Ana além do pedido antigo das fixtures.
async function newOrderIds(page: Page) {
  const orders = await callApi(page, 'GET', '/api/orders', { token: await sessionToken(page) })
  return (orders.body as { id: string }[])
    .map((order) => order.id)
    .filter((orderId) => orderId !== 'order-ana-0001')
}

// Idempotency-Key de cada POST /api/orders feito pela página.
function trackOrderPosts(page: Page) {
  const keys: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/orders')) {
      keys.push(request.headers()['idempotency-key'] ?? '')
    }
  })
  return keys
}

async function connectWallet(page: Page) {
  // No mobile o botão mostra só "Conectar".
  await page.getByRole('button', { name: /^Conectar( carteira)?$/ }).click()
  await expect(page.getByTestId('wallet-status')).toHaveText('Carteira conectada')
}

async function openCheckout(page: Page) {
  await page.goto('/pagamento')
  await connectWallet(page)
  await expect(page.getByTestId('checkout-total')).toHaveText('1.706 ETH')
}

function confirmButton(page: Page) {
  return page.getByRole('button', { name: 'Confirmar compra' })
}

test.describe('com Sage Nomad #009 no carrinho', () => {
  test.beforeEach(async ({ page }) => {
    await startCleanMockServer(page)
    await loginThroughUi(page, 'ana@kurio.dev')
    await page.goto('/nft/sage-nomad-009')
    await page.getByRole('button', { name: 'Comprar' }).click()
    await expectCartCount(page, 1)
  })

  test('preço alterado na hora da compra mostra o que mudou e pede nova confirmação', async ({
    page,
  }) => {
    await setScenario(page, 'price-changed-at-checkout')
    await openCheckout(page)
    await confirmButton(page).click()

    const changes = page.getByTestId('quote-changes')
    await expect(changes).toContainText('Sage Nomad #009: o preço mudou de 1.69 para 1.79 ETH.')
    await expect(changes).toContainText('O total mudou de 1.706 para 1.806 ETH.')
    await expect(page.getByTestId('checkout-total')).toHaveText('1.806 ETH')
    await expect(confirmButton(page)).toHaveCount(0)
    await expect(page).toHaveURL(/\/pagamento$/)

    await page.getByRole('button', { name: 'Revisar novo total' }).click()
    await expect(changes).toHaveCount(0)
    await confirmButton(page).click()
    await expect(page).toHaveURL(/\/pedidos\/order-/)
  })

  test('preço muda pelo socket durante a revisão e pede nova confirmação', async ({ page }) => {
    await openCheckout(page)
    await expect(page.getByTestId('socket-status')).toHaveText('conectado')

    await callApi(page, 'POST', '/api/mock-control/nfts/sage-nomad-009', {
      body: { priceEth: '1.80' },
    })
    await expect(page.getByTestId('quote-changes')).toContainText(
      'O total mudou de 1.706 para 1.816 ETH.',
    )
    await expect(confirmButton(page)).toHaveCount(0)

    await page.getByRole('button', { name: 'Revisar novo total' }).click()
    await expect(page.getByTestId('checkout-total')).toHaveText('1.816 ETH')
    await confirmButton(page).click()
    await expect(page).toHaveURL(/\/pedidos\/order-/)
  })

  test('edição esgota pelo socket durante a revisão e bloqueia a compra', async ({ page }) => {
    await openCheckout(page)
    await expect(page.getByTestId('socket-status')).toHaveText('conectado')

    const { editionId } = await firstCartItem(page)
    await callApi(page, 'POST', '/api/mock-control/nfts/sage-nomad-009', {
      body: { editionId, stock: 0 },
    })
    await expect(page.getByTestId('quote-changes')).toContainText('Sage Nomad #009 esgotou.')
    await expect(page.getByTestId('quote-changes')).toContainText('Ajuste os itens no carrinho')
    await expect(page.getByTestId('checkout-items')).toContainText('Esgotado')
    await expect(confirmButton(page)).toHaveCount(0)

    await page.getByRole('link', { name: 'Ajustar no carrinho' }).click()
    await expect(page).toHaveURL(/\/carrinho$/)
    await expect(page.getByTestId('line-issues')).toContainText('Esgotado')
    expect(await newOrderIds(page)).toHaveLength(0)
  })

  test('estoque menor que a quantidade pelo socket também bloqueia a compra', async ({ page }) => {
    // 3 unidades da edição 1/50 no lugar do item comprado pela tela.
    const token = await sessionToken(page)
    await callApi(page, 'DELETE', `/api/cart/items/${(await firstCartItem(page)).id}`, { token })
    await callApi(page, 'POST', '/api/cart/items', {
      token,
      body: { nftId: 'sage-nomad-009', editionId: '1-50', quantity: 3 },
    })
    await page.goto('/pagamento')
    await connectWallet(page)
    await expect(page.getByTestId('checkout-total')).toHaveText('5.086 ETH')

    await callApi(page, 'POST', '/api/mock-control/nfts/sage-nomad-009', {
      body: { editionId: '1-50', stock: 2 },
    })
    await expect(page.getByTestId('quote-changes')).toContainText(
      'Sage Nomad #009: não há mais estoque para 3.',
    )
    await expect(page.getByRole('link', { name: 'Ajustar no carrinho' })).toBeVisible()
    await expect(confirmButton(page)).toHaveCount(0)
  })

  test('envio com o botão bloqueado e pedido pendente até a confirmação', async ({ page }) => {
    await openCheckout(page)
    const keys = trackOrderPosts(page)
    await confirmButton(page).dblclick()

    // O pedido fica pendente por ~2s: a tela avisa e não deixa enviar de novo.
    const progress = page.getByTestId('order-progress')
    await expect(progress).toContainText('Pagamento pendente')
    await expect(page.getByRole('button', { name: /Confirmar|Confirmando/ })).toHaveCount(0)
    await expect(page.getByLabel('Nome de exibição')).toBeDisabled()

    await expect(page).toHaveURL(/\/pedidos\/order-/)
    await expect(page.getByTestId('order-status')).toHaveText(
      /Seus NFTs agora estão na sua carteira/,
    )
    expect(keys).toHaveLength(1)
    expect(await newOrderIds(page)).toHaveLength(1)
  })

  test('timeout na criação recupera o mesmo pedido com a mesma chave', async ({ page }) => {
    await setScenario(page, 'order-timeout')
    await openCheckout(page)
    const keys = trackOrderPosts(page)
    await confirmButton(page).click()

    // A 1ª resposta se perde; o retry usa a mesma Idempotency-Key e recebe o pedido criado.
    await expect(page).toHaveURL(/\/pedidos\/order-/, { timeout: 10_000 })
    expect(keys.length).toBeGreaterThanOrEqual(2)
    expect(new Set(keys).size).toBe(1)
    expect(await newOrderIds(page)).toHaveLength(1)
  })

  test('sem resposta depois das tentativas, "Tentar de novo" reusa a mesma chave', async ({
    page,
  }) => {
    await openCheckout(page)
    // 1 envio + 3 retries automáticos falham; a tentativa manual passa.
    await callApi(page, 'POST', '/api/mock-control/faults', {
      body: { method: 'POST', path: '/api/orders', status: 503, times: 4 },
    })
    const keys = trackOrderPosts(page)
    await confirmButton(page).click()

    const progress = page.getByTestId('order-progress')
    await expect(progress).toContainText('Não recebemos a resposta do pagamento', {
      timeout: 15_000,
    })
    expect(keys).toHaveLength(4)
    expect(await newOrderIds(page)).toHaveLength(0)

    await progress.getByRole('button', { name: 'Tentar de novo' }).click()
    await expect(page).toHaveURL(/\/pedidos\/order-/)
    expect(keys).toHaveLength(5)
    expect(new Set(keys).size).toBe(1)
    expect(await newOrderIds(page)).toHaveLength(1)
  })

  test('refresh no meio do envio retoma a mesma compra', async ({ page }) => {
    await setScenario(page, 'order-timeout')
    await openCheckout(page)
    const firstAttemptLost = page.waitForEvent(
      'requestfailed',
      (request) => request.method() === 'POST' && request.url().endsWith('/api/orders'),
    )
    await confirmButton(page).click()
    await firstAttemptLost

    // O pedido já foi criado no servidor, mas a resposta não chegou: o usuário recarrega.
    await page.reload()
    await expect(page).toHaveURL(/\/pedidos\/order-/, { timeout: 10_000 })
    await expect(page.getByTestId('order-status')).toHaveText(
      /Seus NFTs agora estão na sua carteira/,
    )
    expect(await newOrderIds(page)).toHaveLength(1)
  })

  test('pagamento recusado mostra o motivo e o caminho de volta', async ({ page }) => {
    await setScenario(page, 'payment-declined')
    await openCheckout(page)
    await confirmButton(page).click()

    const progress = page.getByTestId('order-progress')
    await expect(progress).toContainText('Pagamento recusado')
    await expect(progress).toContainText('A carteira recusou o pagamento')
    await expect(page).toHaveURL(/\/pagamento$/)
    expect(await cartQuantity(page)).toBe(1)

    await progress.getByRole('button', { name: 'Tentar de novo' }).click()
    await expect(confirmButton(page)).toBeFocused()
    await expect(page.getByLabel('Nome de exibição')).toBeEnabled()

    await confirmButton(page).click()
    await expect(page.getByTestId('order-progress')).toContainText('Pagamento recusado')
    await page.getByRole('link', { name: 'Voltar ao carrinho' }).click()
    await expect(page).toHaveURL(/\/carrinho$/)
    await expect(page.getByTestId('cart-items')).toContainText('Sage Nomad #009')
    expect(await cartQuantity(page)).toBe(1)
  })

  test('confirmação tira do carrinho só o que foi comprado, mesmo após refresh', async ({
    page,
  }) => {
    await openCheckout(page)
    await confirmButton(page).click()
    // Pendente: o pedido já existe no servidor.
    await expect(page.getByTestId('order-progress')).toContainText('Pagamento pendente')
    const [orderId] = await newOrderIds(page)

    // Item que entrou no carrinho depois do pedido: não faz parte da compra.
    await callApi(page, 'POST', '/api/cart/items', {
      token: await sessionToken(page),
      body: { nftId: 'emerald-ape-042', editionId: '1-50', quantity: 2 },
    })
    await page.goto(`/pedidos/${orderId}`)
    await expect(page.getByTestId('order-status')).toHaveText(
      /Seus NFTs agora estão na sua carteira/,
    )
    // No mobile o comprovante não tem tab bar (nem badge): confere pela API.
    await expect.poll(() => cartQuantity(page)).toBe(2)
  })

  test('carteira: recusa, app errado, desconexão e conexão perdida no envio', async ({ page }) => {
    await page.goto('/pagamento')
    const status = page.getByTestId('wallet-status')
    const connect = page.getByRole('button', { name: /^Conectar( carteira)?$/ })

    // Confirmar sem carteira conectada leva o foco ao botão de conectar.
    await confirmButton(page).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Conecte a carteira' })).toBeVisible()
    await expect(connect).toBeFocused()

    await setScenario(page, 'wallet-rejected')
    await connect.click()
    await expect(page.getByText('A conexão foi recusada na carteira.')).toBeVisible()
    await expect(status).toHaveText('Carteira desconectada')

    // A carteira principal da Ana é do MetaMask: o Coinbase Wallet não a reconhece.
    await setScenario(page, 'default')
    await page.getByRole('radio', { name: 'Coinbase Wallet' }).check({ force: true })
    await connect.click()
    await expect(page.getByText('Esta carteira está no MetaMask.')).toBeVisible()
    await page.getByRole('radio', { name: 'MetaMask' }).check({ force: true })
    await connect.click()
    await expect(status).toHaveText('Carteira conectada')
    await expect(page.getByTestId('checkout-status')).toHaveText(
      'Carteira Principal conectada pelo MetaMask.',
    )

    await page.getByRole('button', { name: 'Desconectar' }).click()
    await expect(status).toHaveText('Carteira desconectada')
    await expect(page.getByTestId('checkout-status')).toHaveText('Carteira Principal desconectada.')

    // A carteira desconecta sozinha bem antes de o pedido sair.
    await connectWallet(page)
    await setScenario(page, 'wallet-disconnects')
    await confirmButton(page).click()
    await expect(page.getByText('A carteira desconectou antes do envio.')).toBeVisible()
    await expect(status).toHaveText('Carteira desconectada')
    expect(await newOrderIds(page)).toHaveLength(0)
  })

  test('carteira reserva usa a rede dela no resumo e no pedido', async ({ page }) => {
    await page.goto('/pagamento')
    await page.getByRole('radio', { name: /Reserva/ }).check({ force: true })
    // A reserva da Ana é do Coinbase Wallet, na Polygon.
    await expect(page.getByRole('radio', { name: 'Coinbase Wallet' })).toBeChecked()
    await expect(page.getByTestId('checkout-summary')).toContainText('Taxa estimada (Polygon)')
    await expect(page.getByTestId('checkout-total')).toHaveText('1.692 ETH')

    await connectWallet(page)
    await confirmButton(page).click()
    await expect(page).toHaveURL(/\/pedidos\/order-/)
    const [orderId] = await newOrderIds(page)
    const order = await callApi(page, 'GET', `/api/orders/${orderId}`, {
      token: await sessionToken(page),
    })
    expect(order.body.receipt).toMatchObject({
      network: 'polygon',
      wallet: { type: 'coinbase' },
      totalEth: '1.692',
    })
  })

  test('validação dos dados do colecionador', async ({ page }) => {
    await openCheckout(page)
    const displayName = page.getByLabel('Nome de exibição')
    await displayName.fill('A')
    await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill('ana@')
    await confirmButton(page).click()

    await expect(displayName).toHaveAttribute('aria-invalid', 'true')
    await expect(displayName).toHaveAccessibleDescription('Informe seu nome de exibição.')
    await expect(
      page.getByRole('textbox', { name: 'E-mail', exact: true }),
    ).toHaveAccessibleDescription('E-mail inválido.')
    await expect(displayName).toBeFocused()
    expect(await newOrderIds(page)).toHaveLength(0)
  })

  test('teclado: escolhe carteira e app com as setas e confirma', async ({ page }) => {
    await openCheckout(page)
    await page.getByRole('radio', { name: /Principal/ }).focus()
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('radio', { name: /Reserva/ })).toBeChecked()
    await expectFocusVisible(page)
    await page.keyboard.press('ArrowUp')
    await expect(page.getByRole('radio', { name: /Principal/ })).toBeChecked()

    // A conexão da carteira principal continua valendo ao voltar para ela.
    await expect(page.getByTestId('wallet-status')).toHaveText('Carteira conectada')
    await page.getByRole('radio', { name: 'MetaMask' }).focus()
    await expectFocusVisible(page)
    await confirmButton(page).focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/pedidos\/order-/)
  })
})

// No mobile o pagamento não tem badge do carrinho: confere pela API.
async function cartQuantity(page: Page) {
  const cart = await callApi(page, 'GET', '/api/cart', { token: await sessionToken(page) })
  return (cart.body.items as { quantity: number }[]).reduce((sum, item) => sum + item.quantity, 0)
}

async function firstCartItem(page: Page) {
  const cart = await callApi(page, 'GET', '/api/cart', { token: await sessionToken(page) })
  return cart.body.items[0] as { id: string; editionId: string }
}

test('compra completa do catálogo ao recibo', async ({ page }) => {
  await startCleanMockServer(page)
  await loginThroughUi(page, 'ana@kurio.dev')

  // Do catálogo para o detalhe do primeiro NFT da lista.
  await page.goto('/')
  const firstCard = page.getByTestId('catalog-results').locator('li').first()
  const nftName = (await firstCard.getByRole('heading').innerText()).trim()
  await firstCard.getByRole('link').first().click()
  await expect(page.getByRole('heading', { level: 1, name: nftName })).toBeVisible()
  await page.getByRole('button', { name: 'Comprar' }).click()
  await expectCartCount(page, 1)

  await page.getByRole('link', { name: 'Ver carrinho', exact: true }).click()
  await expect(page.getByTestId('cart-total')).toBeVisible()
  await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
  await expect(page).toHaveURL(/\/pagamento$/)

  // O que a tela mostrou antes de confirmar é o que o recibo precisa repetir.
  await connectWallet(page)
  const items = page.getByTestId('checkout-items')
  await expect(items).toContainText(nftName)
  const shownTotal = await page.getByTestId('checkout-total').innerText()
  const shownFee = await page.getByTestId('checkout-fee').innerText()
  await confirmButton(page).click()

  await expect(page).toHaveURL(/\/pedidos\/order-/)
  await expect(page.getByTestId('order-status')).toHaveText(/Seus NFTs agora estão na sua carteira/)
  const receipt = page.getByRole('region', { name: 'Recibo' })
  await expect(receipt.getByTestId('receipt-items')).toContainText(nftName)
  await expect(receipt.getByTestId('receipt-items')).toContainText('(x 1)')
  await expect(receipt.getByTestId('receipt-fee')).toHaveText(shownFee)
  await expect(receipt.getByTestId('receipt-total')).toHaveText(shownTotal)
  await expect(receipt).toContainText('MetaMask')
  await expect(receipt).toContainText('Transação confirmada na Ethereum')
  await expect(receipt.getByTestId('receipt-hash')).toHaveText(/^0x[0-9a-f]{64}$/)
  await expect(receipt.getByRole('note')).toContainText('Transação simulada')
  expect(await cartQuantity(page)).toBe(0)
})
