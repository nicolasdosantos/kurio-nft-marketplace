import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { expectCartCount, isDesktopLayout, loginThroughUi } from '../support/app'
import {
  callApi,
  login,
  orderBody,
  prepareCheckout,
  setScenario,
  startCleanMockServer,
} from '../support/mock-api'

// axe-core em todas as telas e estados principais, desktop e mobile (regras WCAG 2.1 A e AA).
async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const summary = results.violations.map((violation) => ({
    regra: violation.id,
    impacto: violation.impact,
    elementos: violation.nodes.slice(0, 4).map((node) => node.target.join(' ')),
  }))
  expect(summary, JSON.stringify(summary, null, 2)).toEqual([])
}

async function loginAsAna(page: Page) {
  await loginThroughUi(page, 'ana@kurio.dev')
}

async function addSageToCart(page: Page) {
  await page.goto('/nft/sage-nomad-009')
  await page.getByRole('button', { name: 'Comprar' }).click()
  await expectCartCount(page, 1)
}

async function confirmedOrderId(page: Page) {
  const token = await page.evaluate(() => localStorage.getItem('kurio:token') ?? '')
  const quote = await prepareCheckout(page, token)
  const order = await callApi(page, 'POST', '/api/orders', {
    token,
    idempotencyKey: crypto.randomUUID(),
    body: orderBody(quote.id),
  })
  return order.body.id as string
}

const states: { name: string; run: (page: Page) => Promise<void> }[] = [
  {
    name: 'início carregado',
    run: async (page) => {
      await page.goto('/')
      await expect(page.getByTestId('catalog-results').locator('li').first()).toBeVisible()
    },
  },
  {
    name: 'início carregando',
    run: async (page) => {
      await setScenario(page, 'slow')
      await page.goto('/')
      await expect(page.getByTestId('nft-card-skeleton').first()).toBeVisible()
    },
  },
  {
    name: 'início com erro',
    run: async (page) => {
      await setScenario(page, 'server-error')
      await page.goto('/')
      await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible({
        timeout: 15_000,
      })
    },
  },
  {
    name: 'início sem resultados',
    run: async (page) => {
      await page.goto('/?q=nada-com-esse-nome')
      await expect(page.getByText(/Nenhum NFT/)).toBeVisible()
    },
  },
  {
    name: 'filtros ou busca abertos',
    run: async (page) => {
      await page.goto('/')
      await expect(page.getByTestId('catalog-results').locator('li').first()).toBeVisible()
      if (isDesktopLayout(page)) {
        await page.getByRole('button', { name: 'Abrir busca' }).click()
        await expect(page.getByRole('searchbox', { name: 'Buscar NFTs' })).toBeVisible()
      } else {
        await page.getByRole('button', { name: 'Abrir filtros' }).filter({ visible: true }).click()
        await expect(page.getByRole('dialog', { name: 'Filtros' })).toBeVisible()
      }
    },
  },
  {
    name: 'detalhe carregado',
    run: async (page) => {
      await page.goto('/nft/emerald-ape-042')
      await expect(page.getByTestId('nft-price')).toBeVisible()
    },
  },
  {
    name: 'detalhe carregando',
    run: async (page) => {
      await setScenario(page, 'slow')
      await page.goto('/nft/emerald-ape-042')
      await expect(page.getByTestId('nft-detail-skeleton')).toBeVisible()
    },
  },
  {
    name: 'detalhe inexistente',
    run: async (page) => {
      await page.goto('/nft/nao-existe')
      await expect(page.getByRole('heading', { name: /não encontrado/i })).toBeVisible()
    },
  },
  {
    name: 'detalhe com a imagem ampliada',
    run: async (page) => {
      test.skip(!isDesktopLayout(page), 'a lupa só existe na galeria do desktop')
      await page.goto('/nft/emerald-ape-042')
      await page
        .getByRole('button', { name: /Ampliar/ })
        .first()
        .click()
      await expect(page.getByRole('dialog')).toBeVisible()
    },
  },
  {
    name: 'carrinho vazio',
    run: async (page) => {
      await page.goto('/carrinho')
      await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
    },
  },
  {
    name: 'carrinho com itens e cupom inválido',
    run: async (page) => {
      await addSageToCart(page)
      await page.goto('/carrinho')
      await expect(page.getByTestId('cart-total')).toBeVisible()
      const coupon = page.getByLabel('Código promocional').filter({ visible: true })
      await coupon.fill('NAOEXISTE')
      await coupon.press('Enter')
      await expect(page.getByRole('alert').filter({ hasText: 'inválido' })).toBeVisible()
    },
  },
  {
    name: 'carrinho com erro',
    run: async (page) => {
      await setScenario(page, 'server-error')
      await page.goto('/carrinho')
      await expect(page.getByText('Não foi possível carregar o carrinho.')).toBeVisible({
        timeout: 15_000,
      })
    },
  },
  {
    name: 'login com erros',
    run: async (page) => {
      await page.goto('/login')
      await page.getByRole('button', { name: 'Entrar', exact: true }).click()
      await expect(page.getByText('E-mail inválido.')).toBeVisible()
    },
  },
  {
    name: 'cadastro com erros',
    run: async (page) => {
      await page.goto('/cadastro')
      await page.getByRole('button', { name: /^Criar (conta|perfil)$/ }).click()
      await expect(page.getByText('E-mail inválido.')).toBeVisible()
    },
  },
  {
    name: 'página não encontrada',
    run: async (page) => {
      await page.goto('/rota-que-nao-existe')
      await expect(page.getByText('Página não encontrada')).toBeVisible()
    },
  },
  {
    name: 'menu da conta aberto',
    run: async (page) => {
      await loginAsAna(page)
      if (isDesktopLayout(page)) {
        await page.getByTestId('current-user').click()
        await expect(page.getByRole('menu')).toBeVisible()
      } else {
        await page.getByRole('link', { name: 'Minha conta' }).click()
        await expect(page.getByRole('navigation', { name: 'Menu da conta' })).toBeVisible()
      }
    },
  },
  {
    name: 'pagamento preenchido',
    run: async (page) => {
      await loginAsAna(page)
      await addSageToCart(page)
      await page.goto('/pagamento')
      await expect(page.getByTestId('checkout-total')).toBeVisible()
    },
  },
  {
    name: 'pagamento com erros e aviso de mudança',
    run: async (page) => {
      await loginAsAna(page)
      await addSageToCart(page)
      await page.goto('/pagamento')
      await expect(page.getByTestId('checkout-total')).toBeVisible()
      await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill('ana@')
      await page.getByRole('button', { name: 'Confirmar compra' }).click()
      await expect(page.getByText('E-mail inválido.')).toBeVisible()
      await callApi(page, 'POST', '/api/mock-control/nfts/sage-nomad-009', {
        body: { priceEth: '1.80' },
      })
      await expect(page.getByTestId('quote-changes')).toBeVisible()
    },
  },
  {
    name: 'pagamento pendente',
    run: async (page) => {
      await loginAsAna(page)
      await setScenario(page, 'payment-pending')
      await addSageToCart(page)
      await page.goto('/pagamento')
      await page.getByRole('button', { name: /^Conectar( carteira)?$/ }).click()
      await expect(page.getByTestId('wallet-status')).toHaveText('Carteira conectada')
      await page.getByRole('button', { name: 'Confirmar compra' }).click()
      await expect(page.getByTestId('order-progress')).toContainText('Pagamento pendente')
    },
  },
  {
    name: 'comprovante confirmado',
    run: async (page) => {
      await loginAsAna(page)
      const orderId = await confirmedOrderId(page)
      await page.goto(`/pedidos/${orderId}`)
      await expect(page.getByTestId('order-status')).toHaveText(
        'Seus NFTs agora estão na sua carteira',
        { timeout: 10_000 },
      )
    },
  },
  {
    name: 'comprovante de outra conta',
    run: async (page) => {
      const token = await login(page, 'bruno@kurio.dev')
      await page.evaluate((value) => localStorage.setItem('kurio:token', value), token)
      await page.goto('/pedidos/order-ana-0001')
      await expect(
        page.getByRole('heading', { name: 'Este pedido é de outra conta' }),
      ).toBeVisible()
    },
  },
  {
    name: 'perfil com erros',
    run: async (page) => {
      await loginAsAna(page)
      await page.goto('/perfil')
      await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill('bruno@kurio.dev')
      await page.getByRole('button', { name: 'Salvar perfil' }).click()
      await expect(page.getByText('Este e-mail já está em uso.')).toBeVisible()
    },
  },
  {
    name: 'carteiras com formulário e erros',
    run: async (page) => {
      await loginAsAna(page)
      await page.goto('/carteiras')
      await page.getByRole('button', { name: 'Editar carteira secundária' }).click()
      const secondary = page.getByRole('region', { name: 'Carteira secundária' })
      await secondary
        .getByRole('textbox', { name: 'Endereço da carteira', exact: true })
        .fill('0x123')
      await secondary.getByRole('button', { name: 'Salvar carteira' }).click()
      await expect(secondary.getByText(/O endereço precisa começar com 0x/)).toBeVisible()
    },
  },
]

test.beforeEach(async ({ page }) => {
  await startCleanMockServer(page)
})

for (const state of states) {
  test(`axe: ${state.name}`, async ({ page }) => {
    await state.run(page)
    await expectNoViolations(page)
  })
}

test('prefers-reduced-motion desliga shimmer, spinner e animações de diálogo', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const motionOf = (locator: ReturnType<Page['locator']>) =>
    locator.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        animation: parseFloat(style.animationDuration),
        repeats: style.animationIterationCount,
        transition: parseFloat(style.transitionDuration),
      }
    })

  // Skeleton com shimmer durante o carregamento lento.
  await setScenario(page, 'slow')
  await page.goto('/')
  const skeleton = page
    .getByTestId('nft-card-skeleton')
    .first()
    .locator('[data-slot="skeleton"]')
    .first()
  await expect(skeleton).toBeVisible()
  expect(await motionOf(skeleton)).toEqual({
    animation: 0.00001,
    repeats: '1',
    transition: 0.00001,
  })

  // Diálogo (login no desktop) ou Sheet (filtros no mobile) abrindo sem animação.
  await setScenario(page, 'default')
  await page.goto('/')
  await expect(page.getByTestId('catalog-results').locator('li').first()).toBeVisible()
  if (isDesktopLayout(page)) {
    await page.goto('/login')
  } else {
    await page.getByRole('button', { name: 'Abrir filtros' }).filter({ visible: true }).click()
  }
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  expect((await motionOf(dialog)).animation).toBeLessThan(0.001)
})
