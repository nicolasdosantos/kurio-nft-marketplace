import { expect, test, type Page } from '@playwright/test'
import { expectFocusVisible, isDesktopLayout } from '../support/app'
import { callApi, setScenario, startCleanMockServer } from '../support/mock-api'

function field(page: Page, label: string) {
  return page.getByLabel(label, { exact: true })
}

// A mensagem de erro precisa estar ligada ao campo (aria-describedby) e marcá-lo como inválido.
async function expectFieldError(page: Page, label: string, message: string) {
  const input = field(page, label)
  await expect(input).toHaveAttribute('aria-invalid', 'true')
  await expect(input).toHaveAccessibleDescription(message)
}

async function fillRegister(
  page: Page,
  account: { username: string; email: string; password: string; confirm: string },
) {
  await field(page, 'Nome de usuário').fill(account.username)
  await field(page, 'E-mail').fill(account.email)
  await field(page, 'Senha').fill(account.password)
  await field(page, 'Confirmar senha').fill(account.confirm)
}

function submitRegister(page: Page) {
  return page.getByRole('button', { name: /^Criar (conta|perfil)$/ }).click()
}

test.beforeEach(async ({ page }) => {
  await startCleanMockServer(page)
})

test('cadastro pela tela cria a conta e já entra', async ({ page }) => {
  await page.goto('/cadastro')
  await fillRegister(page, {
    username: 'carla.dias',
    email: 'carla@kurio.dev',
    password: 'segredo123',
    confirm: 'segredo123',
  })
  await submitRegister(page)

  await expect(page).toHaveURL(/\/$/)
  const token = await page.evaluate(() => localStorage.getItem('kurio:token') ?? '')
  const session = await callApi(page, 'GET', '/api/auth/session', { token })
  expect(session.body.user).toMatchObject({ username: 'carla.dias', email: 'carla@kurio.dev' })
})

test('cadastro com e-mail ou usuário em uso mostra o erro no campo certo', async ({ page }) => {
  await page.goto('/cadastro')
  await fillRegister(page, {
    username: 'carla.dias',
    email: 'ana@kurio.dev',
    password: 'segredo123',
    confirm: 'segredo123',
  })
  await submitRegister(page)
  await expectFieldError(page, 'E-mail', 'Este e-mail já está em uso.')

  await field(page, 'E-mail').fill('carla@kurio.dev')
  await field(page, 'Nome de usuário').fill('ana.ribeiro')
  await submitRegister(page)
  await expectFieldError(page, 'Nome de usuário', 'Este nome de usuário já está em uso.')
  await expect(page).toHaveURL(/\/cadastro/)
})

test('validação dos campos do cadastro e do login', async ({ page }) => {
  await page.goto('/cadastro')
  await submitRegister(page)
  await expectFieldError(page, 'Nome de usuário', 'Use pelo menos 3 caracteres.')
  await expectFieldError(page, 'E-mail', 'E-mail inválido.')
  await expectFieldError(page, 'Senha', 'A senha precisa ter pelo menos 8 caracteres.')

  await fillRegister(page, {
    username: 'Carla Dias',
    email: 'carla@kurio.dev',
    password: 'segredo123',
    confirm: 'outra-senha',
  })
  await submitRegister(page)
  await expectFieldError(
    page,
    'Nome de usuário',
    'Use só letras minúsculas, números, ponto e underline.',
  )
  await expectFieldError(page, 'Confirmar senha', 'As senhas não são iguais.')

  await page.goto('/login')
  await field(page, 'E-mail').fill('ana@kurio.dev')
  await field(page, 'Senha').fill('senha-errada')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expectFieldError(page, 'Senha', 'E-mail ou senha incorretos.')
})

test('o botão fica bloqueado durante o envio', async ({ page }) => {
  await setScenario(page, 'slow')
  await page.goto('/login')
  await field(page, 'E-mail').fill('ana@kurio.dev')
  await field(page, 'Senha').fill('kurio123')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()

  await expect(page.getByRole('button', { name: 'Entrando...' })).toBeDisabled()
  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 })
})

test('login social e recuperação de senha aparecem só como "em breve"', async ({ page }) => {
  await page.goto('/login')
  for (const text of ['Continuar com Google', 'Continuar com Facebook', 'Esqueceu a senha?']) {
    const item = page.getByText(text)
    await expect(item).toHaveAttribute('aria-disabled', 'true')
    await expect(item).toContainText('(em breve)')
  }
  await expect(page.getByRole('button', { name: /Google|Facebook/ })).toHaveCount(0)
})

test('o diálogo prende o foco e devolve ao botão Entrar ao fechar', async ({ page }) => {
  test.skip(!isDesktopLayout(page), 'no mobile o login é uma página, não um diálogo')
  await page.goto('/')
  const openButton = page.locator('#header-login')
  await openButton.focus()
  await page.keyboard.press('Enter')

  const dialog = page.getByRole('dialog', { name: 'Entrar' })
  await expect(dialog).toBeVisible()
  await expect(field(page, 'E-mail')).toBeFocused()

  // Muitos Tabs para frente e para trás: o foco nunca sai do diálogo.
  for (const key of ['Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Shift+Tab']) {
    await page.keyboard.press(key)
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true)
  }

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page).toHaveURL(/\/$/)
  await expect(openButton).toBeFocused()
  await expectFocusVisible(page)
})
