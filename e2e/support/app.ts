import { expect, type Page, type Request } from '@playwright/test'

export function isDesktopLayout(page: Page) {
  return (page.viewportSize()?.width ?? 0) >= 768
}

// O networkidle não segura as requisições respondidas pelo service worker do MSW: ele
// liberava o teste com buscas do novo usuário ainda em andamento. Aqui contamos as
// chamadas /api/ desde antes da ação e esperamos a contagem zerar e ficar parada.
function trackApiRequests(page: Page) {
  // Só as que começaram depois daqui: as anteriores não entram na conta.
  const inFlight = new Set<Request>()
  let lastChange = Date.now()
  const onStart = (request: Request) => {
    if (!new URL(request.url()).pathname.startsWith('/api/')) return
    inFlight.add(request)
    lastChange = Date.now()
  }
  const onEnd = (request: Request) => {
    if (!inFlight.delete(request)) return
    lastChange = Date.now()
  }
  page.on('request', onStart)
  page.on('requestfinished', onEnd)
  page.on('requestfailed', onEnd)

  return async function waitForApiIdle() {
    // 300ms parado cobre as requisições que ainda estão no interceptor do Axios.
    await expect
      .poll(() => inFlight.size === 0 && Date.now() - lastChange >= 300, { timeout: 10_000 })
      .toBe(true)
    page.off('request', onStart)
    page.off('requestfinished', onEnd)
    page.off('requestfailed', onEnd)
  }
}

export async function loginThroughUi(page: Page, email: string) {
  if (!page.url().includes('/login')) {
    await page.goto('/login')
  }
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill('kurio123')
  const waitForApiIdle = trackApiRequests(page)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
  // Espera as buscas do novo usuário terminarem antes de o teste seguir.
  await waitForApiIdle()
}

// Campo de e-mail do formulário do perfil (o rótulo visível é só "E-mail").
export function profileEmail(page: Page) {
  return page.getByRole('textbox', { name: 'E-mail', exact: true })
}

// Desktop: menu do usuário no header. Mobile: ícone de conta na tab bar.
export async function openProfile(page: Page) {
  if (isDesktopLayout(page)) {
    await page.getByTestId('current-user').click()
    await page.getByRole('menuitem', { name: 'Dados do perfil' }).click()
  } else {
    // No detalhe do NFT e no carrinho não há tab bar: volta antes, como o usuário faria.
    const pathname = new URL(page.url()).pathname
    if (pathname.startsWith('/nft/') || pathname === '/carrinho') {
      await page.getByRole('button', { name: 'Voltar' }).click()
    }
    await page.getByRole('link', { name: 'Minha conta' }).click()
  }
  await expect(profileEmail(page)).toBeVisible()
}

export async function logoutThroughUi(page: Page) {
  const waitForApiIdle = trackApiRequests(page)
  if (isDesktopLayout(page)) {
    await page.getByTestId('current-user').click()
    await page.getByRole('menuitem', { name: 'Sair' }).click()
  } else {
    await openProfile(page)
    await page.getByRole('button', { name: 'Sair' }).click()
  }
  await page.waitForURL((url) => url.pathname === '/')
  await waitForApiIdle()
}

// Com o carrinho vazio o contador some (no header e na tab bar).
export async function expectCartCount(page: Page, count: number) {
  const visibleBadge = page.getByTestId('cart-count').filter({ visible: true })
  if (count === 0) {
    await expect(visibleBadge).toHaveCount(0)
  } else {
    await expect(visibleBadge).toHaveText(String(count))
  }
}

// Filtros ficam na sidebar a partir de 1024px; abaixo disso, dentro do Sheet.
export async function openFiltersIfNeeded(page: Page) {
  const sidebar = page.getByRole('complementary', { name: 'Filtros' })
  if (await sidebar.isVisible()) return
  await page.getByRole('button', { name: 'Abrir filtros' }).filter({ visible: true }).click()
  await expect(page.getByRole('dialog', { name: 'Filtros' })).toBeVisible()
}

export async function closeFiltersIfOpen(page: Page) {
  const sheet = page.getByRole('dialog', { name: 'Filtros' })
  if (await sheet.isVisible()) await page.keyboard.press('Escape')
}

export async function searchCatalog(page: Page, text: string) {
  if (isDesktopLayout(page)) {
    await page.getByRole('button', { name: 'Abrir busca' }).click()
  }
  await page.getByRole('searchbox', { name: 'Buscar NFTs' }).filter({ visible: true }).fill(text)
  await page.keyboard.press('Enter')
}

// O elemento com foco precisa mostrar o anel de foco (outline).
export async function expectFocusVisible(page: Page) {
  const outline = await page.evaluate(() => {
    const element = document.activeElement
    // Rádio e checkbox são invisíveis (sr-only); o anel de foco aparece logo depois deles.
    const isHiddenInput =
      element instanceof HTMLInputElement && ['radio', 'checkbox'].includes(element.type)
    const target = isHiddenInput ? element.nextElementSibling : element
    if (!target) return 'none'
    // Nos campos de login e cadastro o anel fica no contorno, o elemento pai do input.
    const own = getComputedStyle(target).outlineStyle
    return own !== 'none' || !target.parentElement
      ? own
      : getComputedStyle(target.parentElement).outlineStyle
  })
  expect(outline).not.toBe('none')
}

// Sem rolagem horizontal em nenhuma tela. No projeto mobile (celular emulado) a largura da
// janela também precisa continuar a do aparelho: conteúdo largo demais faz o navegador
// reduzir a página inteira, e o innerWidth cresce.
export async function expectNoHorizontalScroll(page: Page, width: number, screen: string) {
  try {
    await measureHorizontalScroll(page, width, screen)
  } catch (error) {
    // Com muitas navegações seguidas e a máquina carregada, o Chromium às vezes ainda troca
    // de documento depois do goto. Espera carregar e mede de novo, uma vez.
    if (!String(error).includes('Execution context was destroyed')) throw error
    await page.waitForLoadState()
    await measureHorizontalScroll(page, width, screen)
  }
}

async function measureHorizontalScroll(page: Page, width: number, screen: string) {
  const sizes = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    inner: window.innerWidth,
    wide: [...document.querySelectorAll('body *')]
      .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
      // As partes de um ícone contam pelo próprio <svg>.
      .filter((element) => !(element instanceof SVGElement && element.tagName !== 'svg'))
      // Carrosséis e faixas de abas passam da tela de propósito, dentro de um contêiner
      // que corta ou rola: só conta o que escapa de verdade.
      .filter((element) => {
        for (let parent = element.parentElement; parent; parent = parent.parentElement) {
          if (getComputedStyle(parent).overflowX !== 'visible') {
            return parent.getBoundingClientRect().right > window.innerWidth + 1
          }
        }
        return true
      })
      .slice(0, 3)
      .map((element) => `${element.tagName}.${String(element.className).slice(0, 50)}`),
  }))
  expect(sizes, `${screen} em ${width}px`).toEqual({ scroll: width, inner: width, wide: [] })
}
