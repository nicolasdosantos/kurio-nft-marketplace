import { expect, test, type Locator } from '@playwright/test'
import { expectFocusVisible, isDesktopLayout, loginThroughUi } from '../support/app'
import { startCleanMockServer } from '../support/mock-api'

test.beforeEach(async ({ page }) => {
  await startCleanMockServer(page)
})

async function expectComingSoon(item: Locator) {
  await expect(item).toHaveAttribute('aria-disabled', 'true')
  await expect(item).toContainText('(em breve)')
  await expect(item).toHaveCSS('opacity', '1')
  // Sem ícone extra: o Figma não tem cadeado.
  await expect(item.locator('svg')).toHaveCount(0)
}

test('itens "em breve" do header e do rodapé: aparência normal, tooltip e clique sem ação', async ({
  page,
}) => {
  test.skip(!isDesktopLayout(page), 'o header só existe a partir de 768px')
  await page.goto('/')
  const header = page.getByRole('navigation', { name: 'Principal' })
  const creators = header.locator('[aria-disabled="true"]', { hasText: 'Criadores' })
  await expectComingSoon(creators)

  const tooltip = creators.getByText('Em breve', { exact: true })
  await expect(tooltip).toBeHidden()
  await creators.hover()
  await expect(tooltip).toBeVisible()
  await creators.click({ force: true })
  await expect(page).toHaveURL(/\/$/)

  // No foco pelo teclado o tooltip também aparece.
  await header.getByRole('link', { name: 'Mercado' }).focus()
  await page.keyboard.press('Tab')
  await expect(creators).toBeFocused()
  await expect(tooltip).toBeVisible()
  await expectFocusVisible(page)

  // Rodapé: mesmo padrão.
  const footerLink = page.locator('footer [aria-disabled="true"]', { hasText: 'Central de ajuda' })
  await footerLink.scrollIntoViewIfNeeded()
  await expectComingSoon(footerLink)
  await footerLink.hover()
  await expect(footerLink.getByText('Em breve', { exact: true })).toBeVisible()
  await footerLink.click({ force: true })
  await expect(page).toHaveURL(/\/$/)
})

test('menu da conta: itens "em breve" com tooltip e sem ação', async ({ page }) => {
  test.skip(!isDesktopLayout(page), 'o menu da conta fica no header')
  await loginThroughUi(page, 'ana@kurio.dev')
  await page.getByTestId('current-user').click()
  const activity = page.getByRole('menuitem', { name: /Atividade/ })
  await expect(activity).toHaveAttribute('aria-disabled', 'true')
  await expect(activity.locator('svg')).toHaveCount(0)
  await expect(activity).toHaveCSS('opacity', '1')
  await activity.hover()
  await expect(activity.getByText('Em breve', { exact: true })).toBeVisible()
  await activity.click({ force: true })
  // O menu continua aberto e a página não muda.
  await expect(activity).toBeVisible()
  await expect(page).toHaveURL(/\/$/)
})

test('leitor de NFT da tab bar: tooltip no foco e clique sem ação', async ({ page }) => {
  test.skip(isDesktopLayout(page), 'a tab bar só existe no celular')
  await page.goto('/')
  const reader = page.getByRole('button', { name: 'Ler código de NFT (em breve)' })
  await expect(reader).toHaveAttribute('aria-disabled', 'true')
  await reader.click({ force: true })
  await expect(page).toHaveURL(/\/$/)
  await reader.focus()
  await expect(reader.getByText('Em breve', { exact: true })).toBeVisible()
})

test('Mercado leva ao catálogo e fica ativo no fluxo de compra, como no Figma', async ({
  page,
}) => {
  test.skip(!isDesktopLayout(page), 'no celular o Figma não tem header nem trilha no detalhe')
  await page.goto('/nft/emerald-ape-042')
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()
  const trail = page.getByRole('navigation', { name: 'Trilha de navegação' })
  await expect(trail).toHaveText(/^Início\s*\/\s*Mercado$/)

  const header = page.getByRole('navigation', { name: 'Principal' })
  const market = header.getByRole('link', { name: 'Mercado' })
  await expect(market).toHaveCSS('font-weight', '700')
  await expect(header.getByRole('link', { name: 'Início' })).toHaveCSS('font-weight', '400')

  await trail.getByRole('link', { name: 'Mercado' }).click()
  await expect(page).toHaveURL(/\/#catalogo$/)
  await expect(page.getByTestId('catalog-results')).toBeInViewport()

  // Na home com filtros, o Mercado do header mantém a busca.
  await page.goto('/?q=golden&page=1')
  await page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('link', { name: 'Mercado' })
    .click()
  await expect(page).toHaveURL(/q=golden.*#catalogo$/)
})
