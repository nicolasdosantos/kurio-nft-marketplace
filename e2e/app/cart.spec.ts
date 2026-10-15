import { expect, test, type Page } from '@playwright/test'
import { expectFocusVisible, isDesktopLayout, loginThroughUi } from '../support/app'
import { callApi, setScenario, startCleanMockServer } from '../support/mock-api'

const SAGE = 'Sage Nomad #009'
const EMERALD = 'Emerald Ape #042'

function guestCartId(page: Page) {
  return page.evaluate(() => localStorage.getItem('kurio:guest-cart-id') ?? '')
}

async function addToGuestCart(page: Page, nftId: string, editionId: string, quantity: number) {
  const cartId = await guestCartId(page)
  await callApi(page, 'POST', '/api/cart/items', {
    cartId,
    body: { nftId, editionId, quantity },
  })
}

// O resumo da tela tem de ser o mesmo da cotação que a API devolve agora.
async function expectTotalFromApi(page: Page) {
  const cartId = await guestCartId(page)
  const quote = await callApi(page, 'POST', '/api/quote', { cartId, body: { network: 'ethereum' } })
  await expect(page.getByTestId('cart-total')).toHaveText(`${quote.body.totalEth} ETH`)
}

function quantityGroup(page: Page, name: string) {
  return page.getByRole('group', { name: `Quantidade de ${name}` })
}

async function openCart(page: Page) {
  await page.goto('/carrinho')
  await expect(page.getByTestId('cart-total')).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await startCleanMockServer(page)
})

test('adicionar, alterar e remover, com o resumo vindo da API', async ({ page }) => {
  await addToGuestCart(page, 'sage-nomad-009', '1-50', 2)
  await addToGuestCart(page, 'emerald-ape-042', '1-50', 1)
  await openCart(page)
  await expectTotalFromApi(page)

  // Clique duplo: o segundo cai com o botão desabilitado e só sai uma alteração.
  const patches: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'PATCH' && request.url().includes('/api/cart/items/')) {
      patches.push(request.url())
    }
  })
  await quantityGroup(page, SAGE).getByRole('button', { name: 'Aumentar quantidade' }).dblclick()
  await expect(page.getByTestId('cart-status')).toHaveText(
    `Quantidade de ${SAGE} atualizada para 3.`,
  )
  await expect(quantityGroup(page, SAGE).getByTestId('quantity')).toHaveText('3')
  expect(patches).toHaveLength(1)
  await expectTotalFromApi(page)

  await page.getByRole('button', { name: `Remover ${EMERALD}, edição 1/50` }).click()
  await expect(page.getByTestId('cart-status')).toHaveText(`${EMERALD} saiu do carrinho.`)
  await expect(page.getByRole('button', { name: /^Remover / })).toHaveCount(1)
  await expectTotalFromApi(page)
})

test('a quantidade respeita o estoque e o máximo por pedido', async ({ page }) => {
  await callApi(page, 'POST', '/api/mock-control/nfts/sage-nomad-009', {
    body: { editionId: '1-50', stock: 3 },
  })
  await addToGuestCart(page, 'sage-nomad-009', '1-50', 2)
  // A edição Aberta tem estoque de sobra, mas o máximo por pedido é 20.
  await addToGuestCart(page, 'emerald-ape-042', 'open', 20)
  await openCart(page)

  const sage = quantityGroup(page, SAGE)
  await sage.getByRole('button', { name: 'Aumentar quantidade' }).click()
  await expect(sage.getByTestId('quantity')).toHaveText('3')
  await expect(sage.getByRole('button', { name: 'Aumentar quantidade' })).toBeDisabled()
  await expect(
    quantityGroup(page, EMERALD).getByRole('button', { name: 'Aumentar quantidade' }),
  ).toBeDisabled()
})

test('cupom válido, inválido e expirado', async ({ page }) => {
  await addToGuestCart(page, 'sage-nomad-009', '1-50', 2)
  await openCart(page)
  const field = page.getByRole('textbox', { name: 'Código promocional' })
  const apply = page.getByRole('button', { name: 'Aplicar' })

  await field.fill('NAOEXISTE')
  await apply.click()
  await expect(
    page.getByRole('alert').filter({ hasText: 'Código promocional inválido.' }),
  ).toBeVisible()
  await expect(field).toHaveAttribute('aria-invalid', 'true')

  await field.fill('EXPIRADO20')
  await apply.click()
  await expect(
    page.getByRole('alert').filter({ hasText: 'Este código promocional expirou.' }),
  ).toBeVisible()

  await field.fill('kurio10')
  await apply.click()
  await expect(page.getByTestId('cart-status')).toHaveText('Cupom KURIO10 aplicado.')
  await expect(page.getByTestId('cart-summary')).toContainText('Desconto do cupom (10%)')
  await expectTotalFromApi(page)

  await page.getByRole('button', { name: 'Remover cupom' }).click()
  await expect(page.getByTestId('cart-status')).toHaveText('Cupom removido.')
  await expect(page.getByTestId('cart-summary')).not.toContainText('Desconto do cupom')
  await expectTotalFromApi(page)
})

test('carrinho de visitante sobrevive ao refresh, vai para o login e é mesclado', async ({
  page,
}) => {
  await addToGuestCart(page, 'sage-nomad-009', '1-50', 2)
  await openCart(page)
  await page.reload()
  await expect(quantityGroup(page, SAGE).getByTestId('quantity')).toHaveText('2')

  // Visitante finalizando: passa pelo login e cai no pagamento.
  await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
  await expect(page).toHaveURL(/\/login\?redirect=%2Fpagamento/)
  await loginThroughUi(page, 'ana@kurio.dev')
  await expect(page).toHaveURL(/\/pagamento$/)

  await openCart(page)
  await expect(quantityGroup(page, SAGE).getByTestId('quantity')).toHaveText('2')
})

test('preço e estoque mudando pelo socket com o carrinho aberto', async ({ page }) => {
  await addToGuestCart(page, 'sage-nomad-009', '1-50', 2)
  await openCart(page)
  await expect(page.getByTestId('socket-status')).toHaveText('conectado')
  const finish = page.getByRole('link', { name: 'Conectar e finalizar' })
  await expect(finish).toBeVisible()

  await callApi(page, 'POST', '/api/mock-control/nfts/sage-nomad-009', {
    body: { priceEth: '2.00' },
  })
  await expect(page.getByTestId('line-issues')).toContainText(
    'O preço mudou de 1.69 para 2.00 ETH.',
  )
  await expect(page.getByTestId('realtime-announcement')).toHaveText(
    `O preço de ${SAGE} mudou para 2.00 ETH.`,
  )
  await expect(page.getByText('Resolva os avisos dos itens para finalizar.')).toBeVisible()
  await expect(finish).toHaveCount(0)
  await expectTotalFromApi(page)

  await page.getByRole('button', { name: 'Aceitar novo preço' }).click()
  await expect(page.getByTestId('line-issues')).toHaveCount(0)
  await expect(finish).toBeVisible()

  await callApi(page, 'POST', '/api/mock-control/nfts/sage-nomad-009', {
    body: { editionId: '1-50', stock: 1 },
  })
  await expect(page.getByTestId('line-issues')).toContainText('Só restam 1.')
  await expect(page.getByTestId('realtime-announcement')).toHaveText(
    `${SAGE}, edição 1/50: restam só 1.`,
  )
  await page.getByRole('button', { name: 'Ajustar para 1' }).click()
  await expect(quantityGroup(page, SAGE).getByTestId('quantity')).toHaveText('1')
  await expect(finish).toBeVisible()

  await callApi(page, 'POST', '/api/mock-control/nfts/sage-nomad-009', {
    body: { editionId: '1-50', stock: 0 },
  })
  await expect(page.getByTestId('line-issues')).toContainText(
    'Esgotado. Remova o item para continuar.',
  )
  await expect(finish).toHaveCount(0)
})

test('controles do carrinho pelo teclado, com foco visível', async ({ page }) => {
  test.skip(!isDesktopLayout(page), 'a ordem do tab é a mesma; o teste roda no desktop')
  await addToGuestCart(page, 'sage-nomad-009', '1-50', 2)
  await openCart(page)

  const sage = quantityGroup(page, SAGE)
  await sage.getByRole('button', { name: 'Diminuir quantidade' }).focus()
  await page.keyboard.press('Tab')
  await expect(sage.getByRole('button', { name: 'Aumentar quantidade' })).toBeFocused()
  await expectFocusVisible(page)
  await page.keyboard.press('Enter')
  await expect(sage.getByTestId('quantity')).toHaveText('3')

  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: `Remover ${SAGE}, edição 1/50` })).toBeFocused()
  await expectFocusVisible(page)

  await page.keyboard.press('Tab')
  await expect(page.getByRole('textbox', { name: 'Código promocional' })).toBeFocused()
  await page.keyboard.type('KURIO10')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('cart-status')).toHaveText('Cupom KURIO10 aplicado.')
})

test('carrinho vazio leva de volta ao catálogo e o erro tem nova tentativa', async ({ page }) => {
  await page.goto('/carrinho')
  await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
  await page.getByRole('link', { name: 'Explorar o mercado' }).click()
  await expect(page).toHaveURL(/\/$/)

  await setScenario(page, 'server-error')
  await page.goto('/carrinho')
  const errorBox = page
    .getByRole('alert')
    .filter({ hasText: 'Não foi possível carregar o carrinho.' })
  await expect(errorBox).toBeVisible({ timeout: 15_000 })
  await callApi(page, 'PUT', '/api/mock-control/scenario', { body: { name: 'default' } })
  await errorBox.getByRole('button', { name: 'Tentar de novo' }).click()
  await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
})
