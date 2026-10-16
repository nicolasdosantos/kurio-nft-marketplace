import { expect, test, type Page } from '@playwright/test'
import { expectCartCount, expectNoHorizontalScroll, loginThroughUi } from '../support/app'
import {
  callApi,
  orderBody,
  prepareCheckout,
  startCleanMockServer,
  waitForMocks,
} from '../support/mock-api'

// Larguras de monitor comuns, incluindo 1920 com escala de 125% (1536) e 150% (1280) do Windows.
const widths = [1024, 1152, 1280, 1366, 1440, 1536, 1600, 1920, 2560]

test.skip(({ isMobile }) => isMobile, 'larguras de desktop')

interface Box {
  name: string
  left: number
  right: number
  top: number
  bottom: number
}

// Navegação, busca, carrinho e Entrar/menu não podem se encostar nem passar da linha do header.
async function expectCleanHeader(page: Page, label: string) {
  const header = await page.evaluate(() => {
    const box = (name: string, element: Element | null) => {
      if (!element) return null
      const rect = element.getBoundingClientRect()
      return { name, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
    }
    const root = document.querySelector('header')
    return {
      items: [
        box('logo', root?.querySelector('a') ?? null),
        box('navegação', root?.querySelector('nav[aria-label="Principal"]') ?? null),
        box('busca', root?.querySelector('[aria-label="Abrir busca"]') ?? null),
        box('carrinho', root?.querySelector('[data-testid="cart-link"]') ?? null),
        box(
          'conta',
          root?.querySelector('#header-login, [data-testid="current-user"]') ??
            root?.querySelector('[data-testid="header-account-placeholder"]') ??
            null,
        ),
      ],
      line: box('linha', root?.querySelector('img[src="/icons/header-divider.svg"]') ?? null),
    }
  })

  const items = header.items.filter((item): item is Box => item !== null)
  expect(
    items.map((item) => item.name),
    `${label}: itens do header`,
  ).toEqual(['logo', 'navegação', 'busca', 'carrinho', 'conta'])
  const overlaps: string[] = []
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]!
      const b = items[j]!
      const apart = a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top
      if (!apart) overlaps.push(`${a.name} x ${b.name}`)
    }
  }
  const line = header.line!
  for (const item of items) {
    if (item.bottom > line.top) overlaps.push(`${item.name} passa da linha`)
  }
  expect(overlaps, `${label}: sobreposição no header`).toEqual([])
}

// Com centenas de navegações seguidas, às vezes a anterior ainda está terminando e o
// Chromium aborta a nova (ERR_ABORTED). Tenta de novo uma vez só nesse caso.
async function goto(page: Page, path: string) {
  try {
    await page.goto(path)
  } catch (error) {
    if (!String(error).includes('ERR_ABORTED')) throw error
    await page.goto(path)
  }
}

async function checkScreen(page: Page, width: number, screen: string, path: string, ready: string) {
  await goto(page, path)
  await page.locator(ready).first().waitFor({ state: 'attached' })
  // O header termina de renderizar depois da sessão conferida: espera o Entrar ou o menu.
  await page.locator('header').locator('#header-login, [data-testid="current-user"]').waitFor()
  await page.waitForTimeout(300)
  await expectNoHorizontalScroll(page, width, screen)
  await expectCleanHeader(page, `${screen} em ${width}px`)
}

// Três larguras por teste, para rodar em paralelo e não estourar o tempo.
const widthGroups = [widths.slice(0, 3), widths.slice(3, 6), widths.slice(6)]

for (const group of widthGroups) {
  test(`todas as telas em ${group.join(', ')}px, como visitante e logado`, async ({ page }) => {
    test.setTimeout(180_000)
    await startCleanMockServer(page)

    const visitorScreens: [string, string, string][] = [
      ['Início', '/', '[data-testid="catalog-results"]'],
      ['Detalhe', '/nft/emerald-ape-042', '[data-testid="nft-price"]'],
      ['Carrinho', '/carrinho', '[data-testid="cart-content"]'],
      ['Login', '/login', 'form'],
      ['Cadastro', '/cadastro', 'form'],
    ]
    for (const width of group) {
      await page.setViewportSize({ width, height: 900 })
      for (const [screen, path, ready] of visitorScreens) {
        await checkScreen(page, width, `${screen} (visitante)`, path, ready)
      }
    }

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

    const userScreens: [string, string, string][] = [
      ['Início', '/', '[data-testid="catalog-results"]'],
      ['Detalhe', '/nft/emerald-ape-042', '[data-testid="nft-price"]'],
      ['Carrinho', '/carrinho', '[data-testid="cart-total"]'],
      ['Pagamento', '/pagamento', '[data-testid="checkout-total"]'],
      ['Comprovante', `/pedidos/${order.body.id}`, '[data-testid="order-status"]'],
      ['Perfil', '/perfil', '[data-testid="profile-status"]'],
      ['Carteiras', '/carteiras', '[data-testid="primary-wallet-card"]'],
    ]
    for (const width of group) {
      await page.setViewportSize({ width, height: 900 })
      for (const [screen, path, ready] of userScreens) {
        await checkScreen(page, width, `${screen} (logado)`, path, ready)
      }
    }
  })
}

// O diálogo inteiro na tela, ou rolando por dentro; o botão de fechar sempre visível.
async function expectDialogFits(page: Page, label: string) {
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  const sizes = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      top: rect.top,
      bottom: rect.bottom,
      height: window.innerHeight,
      scrolls: element.scrollHeight > element.clientHeight + 1,
      canScroll: ['auto', 'scroll'].includes(getComputedStyle(element).overflowY),
    }
  })
  expect(sizes.top, `${label}: topo do diálogo`).toBeGreaterThanOrEqual(0)
  expect(sizes.bottom, `${label}: fim do diálogo`).toBeLessThanOrEqual(sizes.height + 1)
  if (sizes.scrolls) expect(sizes.canScroll, `${label}: rola por dentro`).toBe(true)
  await expect(dialog.getByRole('button', { name: 'Fechar' }).first()).toBeInViewport()
}

test('modais cabem ou rolam por dentro em janelas baixas e altas', async ({ page }) => {
  test.setTimeout(120_000)
  await startCleanMockServer(page)
  const sizes = [
    { width: 1366, height: 600 },
    { width: 1280, height: 650 },
    { width: 1920, height: 800 },
    { width: 1440, height: 1200 },
  ]
  for (const size of sizes) {
    await page.setViewportSize(size)
    for (const path of ['/login', '/cadastro']) {
      await goto(page, path)
      await expectDialogFits(page, `${path} em ${size.width}x${size.height}`)
    }
  }

  await goto(page, '/login')
  await waitForMocks(page)
  await loginThroughUi(page, 'ana@kurio.dev')
  for (const size of sizes) {
    await page.setViewportSize(size)
    await goto(page, '/pedidos/order-ana-0001')
    await expectDialogFits(page, `comprovante em ${size.width}x${size.height}`)
  }
})
