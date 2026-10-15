import { expect, type Page } from '@playwright/test'

export function isDesktopLayout(page: Page) {
  return (page.viewportSize()?.width ?? 0) >= 768
}

export async function loginThroughUi(page: Page, email: string) {
  if (!page.url().includes('/login')) {
    await page.goto('/login')
  }
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill('kurio123')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
  // Espera as buscas do novo usuário terminarem antes de o teste seguir.
  await page.waitForLoadState('networkidle')
}

// Desktop: menu do usuário no header. Mobile: ícone de conta na tab bar.
export async function openProfile(page: Page) {
  if (isDesktopLayout(page)) {
    await page.getByTestId('current-user').click()
    await page.getByRole('menuitem', { name: 'Dados do perfil' }).click()
  } else {
    await page.getByRole('link', { name: 'Minha conta' }).click()
  }
  await expect(page.getByTestId('profile-email')).toBeVisible()
}

export async function logoutThroughUi(page: Page) {
  if (isDesktopLayout(page)) {
    await page.getByTestId('current-user').click()
    await page.getByRole('menuitem', { name: 'Sair' }).click()
  } else {
    await openProfile(page)
    await page.getByRole('button', { name: 'Sair' }).click()
  }
  await page.waitForURL((url) => url.pathname === '/')
  await page.waitForLoadState('networkidle')
}

// No mobile o badge some quando o carrinho está vazio.
export async function expectCartCount(page: Page, count: number) {
  const visibleBadge = page.getByTestId('cart-count').filter({ visible: true })
  if (count === 0 && !isDesktopLayout(page)) {
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
