import { expect, test } from '@playwright/test'
import {
  callApi,
  login,
  orderBody,
  prepareCheckout,
  setScenario,
  startCleanMockServer,
  waitForMocks,
} from '../support/mock-api'

test.beforeEach(async ({ page }) => {
  await startCleanMockServer(page)
})

test.describe('sessão e conta', () => {
  test('os dois usuários fazem login e recuperam a sessão', async ({ page }) => {
    for (const email of ['ana@kurio.dev', 'bruno@kurio.dev']) {
      const token = await login(page, email)
      const session = await callApi(page, 'GET', '/api/auth/session', { token })
      expect(session.status).toBe(200)
      expect(session.body.user.email).toBe(email)
      expect(session.body.user).not.toHaveProperty('passwordHash')
    }
  })

  test('senha errada, cadastro duplicado e campos inválidos', async ({ page }) => {
    const wrongPassword = await callApi(page, 'POST', '/api/auth/login', {
      body: { email: 'ana@kurio.dev', password: 'errada123' },
    })
    expect(wrongPassword.status).toBe(401)
    expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS')

    const duplicated = await callApi(page, 'POST', '/api/auth/register', {
      body: {
        displayName: 'Outra Ana',
        username: 'outra.ana',
        email: 'ana@kurio.dev',
        password: 'senha1234',
      },
    })
    expect(duplicated.status).toBe(409)
    expect(duplicated.body.error.fields.email).toBeTruthy()

    const invalid = await callApi(page, 'POST', '/api/auth/register', {
      body: { displayName: 'A', username: 'X', email: 'nao-e-email', password: '123' },
    })
    expect(invalid.status).toBe(422)
    expect(Object.keys(invalid.body.error.fields)).toEqual(
      expect.arrayContaining(['displayName', 'username', 'email', 'password']),
    )
  })

  test('senha não fica em texto puro no banco simulado', async ({ page }) => {
    const storedDb = await page.evaluate(() => localStorage.getItem('kurio:mock-db:v2'))
    expect(storedDb).not.toContain('kurio123')
  })

  test('sessão expirada responde 401 SESSION_EXPIRED', async ({ page }) => {
    const token = await login(page, 'ana@kurio.dev')
    await callApi(page, 'POST', '/api/mock-control/expire-sessions')

    const favorites = await callApi(page, 'GET', '/api/favorites', { token })
    expect(favorites.status).toBe(401)
    expect(favorites.body.error.code).toBe('SESSION_EXPIRED')
  })
})

test.describe('isolamento entre usuários', () => {
  test('favoritos, carteiras, carrinho e pedidos são de cada um', async ({ page }) => {
    const anaToken = await login(page, 'ana@kurio.dev')
    const brunoToken = await login(page, 'bruno@kurio.dev')

    await callApi(page, 'PUT', '/api/favorites/sage-nomad-009', { token: anaToken })
    await callApi(page, 'POST', '/api/cart/items', {
      token: anaToken,
      body: { nftId: 'golden-beat-207', editionId: 'open', quantity: 3 },
    })

    const brunoFavorites = await callApi(page, 'GET', '/api/favorites', { token: brunoToken })
    expect(brunoFavorites.body.nftIds).toEqual(['golden-beat-207'])

    const brunoCart = await callApi(page, 'GET', '/api/cart', { token: brunoToken })
    expect(brunoCart.body.items).toEqual([])

    const brunoWallets = await callApi(page, 'GET', '/api/wallets', { token: brunoToken })
    expect(brunoWallets.body.primary.walletType).toBe('coinbase')
    expect(brunoWallets.body.secondary).toBeNull()

    const brunoOrders = await callApi(page, 'GET', '/api/orders', { token: brunoToken })
    expect(brunoOrders.body).toEqual([])

    const anaOrderByBruno = await callApi(page, 'GET', '/api/orders/order-ana-0001', {
      token: brunoToken,
    })
    expect(anaOrderByBruno.status).toBe(403)

    const withoutToken = await callApi(page, 'GET', '/api/favorites')
    expect(withoutToken.status).toBe(401)
  })
})

test.describe('catálogo', () => {
  test('filtros combinados, ordenação, paginação e 404', async ({ page }) => {
    const firstPage = await callApi(page, 'GET', '/api/nfts?sort=price-asc')
    expect(firstPage.body.items).toHaveLength(9)
    expect(firstPage.body.total).toBe(45)
    expect(firstPage.body.totalPages).toBe(5)
    expect(firstPage.body.items[0].priceEth).toBe('0.02')

    const filtered = await callApi(
      page,
      'GET',
      '/api/nfts?collection=musica&network=ethereum&minPrice=0.5&sort=price-desc',
    )
    const names = filtered.body.items.map((nft: { name: string }) => nft.name)
    expect(names).toEqual(['Golden Track #402', 'Golden Beat #207'])

    const empty = await callApi(page, 'GET', '/api/nfts?q=nao-existe-nada')
    expect(empty.body.items).toEqual([])
    expect(empty.body.total).toBe(0)

    const missing = await callApi(page, 'GET', '/api/nfts/nao-existe')
    expect(missing.status).toBe(404)
  })
})

test.describe('carrinho e cupom', () => {
  test('respeita o estoque por edição', async ({ page }) => {
    const tooMany = await callApi(page, 'POST', '/api/cart/items', {
      cartId: 'guest-1',
      body: { nftId: 'sage-nomad-009', editionId: '1-1', quantity: 2 },
    })
    expect(tooMany.status).toBe(409)
    expect(tooMany.body.error.code).toBe('OUT_OF_STOCK')
    expect(tooMany.body.error.details.available).toBe(1)
  })

  test('cupom válido, inválido e expirado', async ({ page }) => {
    const cartId = 'guest-coupon'
    await callApi(page, 'POST', '/api/cart/items', {
      cartId,
      body: { nftId: 'emerald-ape-042', editionId: '1-50', quantity: 2 },
    })

    const expired = await callApi(page, 'PUT', '/api/cart/coupon', {
      cartId,
      body: { code: 'EXPIRADO20' },
    })
    expect(expired.status).toBe(422)
    expect(expired.body.error.code).toBe('COUPON_EXPIRED')

    const invalid = await callApi(page, 'PUT', '/api/cart/coupon', {
      cartId,
      body: { code: 'NAOEXISTE' },
    })
    expect(invalid.body.error.code).toBe('COUPON_INVALID')

    await callApi(page, 'PUT', '/api/cart/coupon', { cartId, body: { code: 'kurio10' } })
    const quote = await callApi(page, 'POST', '/api/quote', {
      cartId,
      body: { network: 'ethereum' },
    })
    expect(quote.body).toMatchObject({
      subtotalEth: '2.38',
      discountEth: '0.238',
      networkFeeEth: '0.016',
      totalEth: '2.158',
      coupon: { code: 'KURIO10', percentOff: 10 },
    })
  })

  test('carrinho do visitante é mesclado no login e não volta depois', async ({ page }) => {
    const guestCartId = 'guest-merge'
    await callApi(page, 'POST', '/api/cart/items', {
      cartId: guestCartId,
      body: { nftId: 'sage-nomad-009', editionId: 'open', quantity: 2 },
    })

    const token = await login(page, 'bruno@kurio.dev', { guestCartId })
    const userCart = await callApi(page, 'GET', '/api/cart', { token })
    expect(userCart.body.items).toHaveLength(1)
    expect(userCart.body.items[0]).toMatchObject({ nftId: 'sage-nomad-009', quantity: 2 })

    await callApi(page, 'POST', '/api/auth/logout', { token })
    const oldGuestCart = await callApi(page, 'GET', '/api/cart', { cartId: guestCartId })
    expect(oldGuestCart.body.items).toEqual([])
  })
})

test.describe('pedidos', () => {
  test('mesma chave devolve o mesmo pedido e conteúdo diferente dá 409', async ({ page }) => {
    const token = await login(page, 'ana@kurio.dev')
    const quote = await prepareCheckout(page, token)

    const created = await callApi(page, 'POST', '/api/orders', {
      token,
      idempotencyKey: 'chave-1',
      body: orderBody(quote.id),
    })
    expect(created.status).toBe(201)
    expect(created.body.status).toBe('pending')

    const repeated = await callApi(page, 'POST', '/api/orders', {
      token,
      idempotencyKey: 'chave-1',
      body: orderBody(quote.id),
    })
    expect(repeated.status).toBe(200)
    expect(repeated.body.id).toBe(created.body.id)

    const conflicting = await callApi(page, 'POST', '/api/orders', {
      token,
      idempotencyKey: 'chave-1',
      body: { ...orderBody(quote.id), network: 'polygon' },
    })
    expect(conflicting.status).toBe(409)
    expect(conflicting.body.error.code).toBe('IDEMPOTENCY_CONFLICT')

    const orders = await callApi(page, 'GET', '/api/orders', { token })
    expect(
      orders.body.filter((order: { id: string }) => order.id === created.body.id),
    ).toHaveLength(1)
  })

  test('confirma após o processamento, mesmo com refresh, e o recibo não muda', async ({
    page,
  }) => {
    const token = await login(page, 'ana@kurio.dev')
    const quote = await prepareCheckout(page, token)
    const created = await callApi(page, 'POST', '/api/orders', {
      token,
      idempotencyKey: 'chave-refresh',
      body: orderBody(quote.id),
    })

    // Refresh no meio do pagamento: o pedido continua pendente e se resolve depois.
    await page.reload()
    await waitForMocks(page)
    await page.waitForTimeout(2200)

    const confirmed = await callApi(page, 'GET', `/api/orders/${created.body.id}`, { token })
    expect(confirmed.body.status).toBe('confirmed')
    expect(confirmed.body.receipt.totalEth).toBe('2.396')

    const cart = await callApi(page, 'GET', '/api/cart', { token })
    expect(cart.body.items).toEqual([])

    await callApi(page, 'POST', '/api/mock-control/nfts/emerald-ape-042', {
      body: { priceEth: '5.00' },
    })
    const afterPriceChange = await callApi(page, 'GET', `/api/orders/${created.body.id}`, { token })
    expect(afterPriceChange.body.receipt).toEqual(confirmed.body.receipt)
  })

  test('timeout depois de criar o pedido é recuperado pela mesma chave', async ({ page }) => {
    const token = await login(page, 'ana@kurio.dev')
    const quote = await prepareCheckout(page, token)
    await setScenario(page, 'order-timeout')

    const lost = await callApi(page, 'POST', '/api/orders', {
      token,
      idempotencyKey: 'chave-timeout',
      body: orderBody(quote.id),
    })
    expect(lost.status).toBe(0)

    const retry = await callApi(page, 'POST', '/api/orders', {
      token,
      idempotencyKey: 'chave-timeout',
      body: orderBody(quote.id),
    })
    expect(retry.status).toBe(200)

    const pending = await callApi(page, 'GET', '/api/orders', { token })
    const newOrders = pending.body.filter((order: { id: string }) => order.id !== 'order-ana-0001')
    expect(newOrders).toHaveLength(1)
    expect(newOrders[0].id).toBe(retry.body.id)
  })

  test('preço alterado na hora da compra exige nova cotação', async ({ page }) => {
    const token = await login(page, 'ana@kurio.dev')
    const quote = await prepareCheckout(page, token)
    await setScenario(page, 'price-changed-at-checkout')

    const outdated = await callApi(page, 'POST', '/api/orders', {
      token,
      idempotencyKey: 'chave-preco-1',
      body: orderBody(quote.id),
    })
    expect(outdated.status).toBe(409)
    expect(outdated.body.error.code).toBe('QUOTE_OUTDATED')
    expect(outdated.body.error.details.quote.totalEth).toBe('2.596')

    const accepted = await callApi(page, 'POST', '/api/orders', {
      token,
      idempotencyKey: 'chave-preco-2',
      body: orderBody(outdated.body.error.details.quote.id),
    })
    expect(accepted.status).toBe(201)
  })

  test('pagamento recusado mantém o carrinho', async ({ page }) => {
    const token = await login(page, 'ana@kurio.dev')
    const quote = await prepareCheckout(page, token)
    await setScenario(page, 'payment-declined')

    const created = await callApi(page, 'POST', '/api/orders', {
      token,
      idempotencyKey: 'chave-recusa',
      body: orderBody(quote.id),
    })
    await page.waitForTimeout(2200)

    const declined = await callApi(page, 'GET', `/api/orders/${created.body.id}`, { token })
    expect(declined.body).toMatchObject({ status: 'declined', failureReason: 'PAYMENT_DECLINED' })

    const cart = await callApi(page, 'GET', '/api/cart', { token })
    expect(cart.body.items[0].quantity).toBe(2)
  })

  test('edição esgotada antes de confirmar recusa o pedido', async ({ page }) => {
    const token = await login(page, 'ana@kurio.dev')
    const quote = await prepareCheckout(page, token)
    const created = await callApi(page, 'POST', '/api/orders', {
      token,
      idempotencyKey: 'chave-estoque',
      body: orderBody(quote.id),
    })

    await callApi(page, 'POST', '/api/mock-control/nfts/emerald-ape-042', {
      body: { editionId: '1-50', stock: 0 },
    })
    await page.waitForTimeout(2200)

    const declined = await callApi(page, 'GET', `/api/orders/${created.body.id}`, { token })
    expect(declined.body).toMatchObject({ status: 'declined', failureReason: 'OUT_OF_STOCK' })
  })

  test('carteira recusada ou desconectada bloqueia a compra', async ({ page }) => {
    const token = await login(page, 'ana@kurio.dev')
    const quote = await prepareCheckout(page, token)

    await callApi(page, 'POST', '/api/wallets/primary/disconnect', { token })
    const disconnected = await callApi(page, 'POST', '/api/orders', {
      token,
      idempotencyKey: 'chave-carteira',
      body: orderBody(quote.id),
    })
    expect(disconnected.body.error.code).toBe('WALLET_DISCONNECTED')

    await setScenario(page, 'wallet-rejected')
    const rejected = await callApi(page, 'POST', '/api/wallets/primary/connect', {
      token,
      body: { network: 'ethereum' },
    })
    expect(rejected.status).toBe(409)
    expect(rejected.body.error.code).toBe('WALLET_REJECTED')
  })
})

test.describe('cenários e reset', () => {
  test('falha configurada só na rota de favoritos', async ({ page }) => {
    const token = await login(page, 'ana@kurio.dev')
    await callApi(page, 'POST', '/api/mock-control/faults', {
      body: { method: 'PUT', path: '/api/favorites/:nftId', status: 500 },
    })

    const failed = await callApi(page, 'PUT', '/api/favorites/sage-nomad-009', { token })
    expect(failed.status).toBe(500)

    const otherRoute = await callApi(page, 'GET', '/api/favorites', { token })
    expect(otherRoute.status).toBe(200)

    const nextTry = await callApi(page, 'PUT', '/api/favorites/sage-nomad-009', { token })
    expect(nextTry.status).toBe(204)
  })

  test('offline e erro de servidor', async ({ page }) => {
    await setScenario(page, 'offline')
    expect((await callApi(page, 'GET', '/api/nfts')).status).toBe(0)

    await setScenario(page, 'server-error')
    expect((await callApi(page, 'GET', '/api/nfts')).status).toBe(500)
    expect((await callApi(page, 'POST', '/api/cart/items', { cartId: 'g', body: {} })).status).toBe(
      503,
    )
  })

  test('dados persistem no refresh e o reset restaura o cenário conhecido', async ({ page }) => {
    const token = await login(page, 'ana@kurio.dev')
    await callApi(page, 'DELETE', '/api/favorites/emerald-ape-042', { token })
    await callApi(page, 'POST', '/api/mock-control/nfts/emerald-ape-042', {
      body: { priceEth: '9.99' },
    })
    await setScenario(page, 'slow')

    await page.reload()
    await waitForMocks(page)
    const afterReload = await callApi(page, 'GET', '/api/favorites', { token })
    expect(afterReload.body.nftIds).not.toContain('emerald-ape-042')

    await callApi(page, 'POST', '/api/mock-control/reset')

    const scenario = await callApi(page, 'GET', '/api/mock-control/scenario')
    expect(scenario.body.name).toBe('default')

    const nft = await callApi(page, 'GET', '/api/nfts/emerald-ape-042')
    expect(nft.body.priceEth).toBe('1.19')

    const oldSession = await callApi(page, 'GET', '/api/favorites', { token })
    expect(oldSession.status).toBe(401)

    const newToken = await login(page, 'ana@kurio.dev')
    const favorites = await callApi(page, 'GET', '/api/favorites', { token: newToken })
    expect(favorites.body.nftIds).toContain('emerald-ape-042')
  })
})
