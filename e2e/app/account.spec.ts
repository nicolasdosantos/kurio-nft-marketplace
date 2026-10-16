import { expect, test, type Page } from '@playwright/test'
import {
  expectFocusVisible,
  isDesktopLayout,
  loginThroughUi,
  logoutThroughUi,
  profileEmail,
} from '../support/app'
import { callApi, setScenario, startCleanMockServer } from '../support/mock-api'

// PNG 1x1 válido, para o envio de avatar.
const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const anaPrimaryAddress = '0xA91F5c3D7e2B8a4C6d0E1f9B3a5C7e2D4f6AE82C'
const anaSecondaryAddress = '0x5B2d8F1a3C9e7D4b6A0f2E8c1D3b5A7f9C0e2B4d'

function textbox(scope: Page | ReturnType<Page['locator']>, name: string) {
  return scope.getByRole('textbox', { name, exact: true })
}

// O rótulo visível tem o asterisco escondido do leitor de tela: o nome acessível é o texto.
async function expectFieldError(
  scope: Page | ReturnType<Page['locator']>,
  name: string,
  message: string,
) {
  const field = textbox(scope, name)
  await expect(field).toHaveAttribute('aria-invalid', 'true')
  await expect(field).toHaveAccessibleDescription(message)
}

function walletSection(page: Page, title: 'Carteira principal' | 'Carteira secundária') {
  return page.getByRole('region', { name: title })
}

test.beforeEach(async ({ page }) => {
  await startCleanMockServer(page)
})

test.describe('perfil da Ana', () => {
  test.beforeEach(async ({ page }) => {
    await loginThroughUi(page, 'ana@kurio.dev')
    await page.goto('/perfil')
    await expect(profileEmail(page)).toHaveValue('ana@kurio.dev')
  })

  test('editar o perfil salva e atualiza o nome no header', async ({ page }) => {
    await textbox(page, 'Nome de exibição').fill('Ana R. Costa')
    await textbox(page, 'Nome de usuário').fill('ana.costa')
    await textbox(page, 'Nome ENS').fill('anacosta')
    await page.getByRole('button', { name: 'Salvar perfil' }).click()

    await expect(page.getByTestId('profile-status')).toHaveText('Perfil salvo.')
    if (isDesktopLayout(page)) {
      await expect(page.getByTestId('current-user')).toContainText('Ana R. Costa')
    }
    await page.reload()
    await expect(textbox(page, 'Nome de usuário')).toHaveValue('ana.costa')
    await expect(textbox(page, 'Nome ENS')).toHaveValue('anacosta')
    const profile = await callApi(page, 'GET', '/api/profile', {
      token: await page.evaluate(() => localStorage.getItem('kurio:token') ?? ''),
    })
    expect(profile.body).toMatchObject({ displayName: 'Ana R. Costa', ensName: 'anacosta.eth' })
  })

  test('e-mail ou usuário em uso aparecem no campo certo', async ({ page }) => {
    await profileEmail(page).fill('bruno@kurio.dev')
    await page.getByRole('button', { name: 'Salvar perfil' }).click()
    await expectFieldError(page, 'E-mail', 'Este e-mail já está em uso.')
    await expect(profileEmail(page)).toBeFocused()

    await profileEmail(page).fill('ana@kurio.dev')
    await textbox(page, 'Nome de usuário').fill('bruno.costa')
    await page.getByRole('button', { name: 'Salvar perfil' }).click()
    await expectFieldError(page, 'Nome de usuário', 'Este nome de usuário já está em uso.')
    await expect(page.getByTestId('profile-status')).toBeEmpty()
  })

  test('validação dos campos e botão bloqueado durante o envio', async ({ page }) => {
    await textbox(page, 'Nome de exibição').fill('A')
    await profileEmail(page).fill('ana@')
    await textbox(page, 'Nome ENS').fill('AB')
    await page.getByRole('button', { name: 'Salvar perfil' }).click()
    await expectFieldError(page, 'Nome de exibição', 'Informe seu nome de exibição.')
    await expectFieldError(page, 'E-mail', 'E-mail inválido.')
    await expect(textbox(page, 'Nome ENS')).toHaveAttribute('aria-invalid', 'true')

    await textbox(page, 'Nome de exibição').fill('Ana Ribeiro')
    await profileEmail(page).fill('ana@kurio.dev')
    await textbox(page, 'Nome ENS').fill('anaribeiro')
    await setScenario(page, 'slow')
    await page.getByRole('button', { name: 'Salvar perfil' }).click()
    await expect(page.getByRole('button', { name: 'Salvando...' })).toBeDisabled()
    await expect(textbox(page, 'Nome de exibição')).toBeDisabled()
    await expect(page.getByTestId('profile-status')).toHaveText('Perfil salvo.', {
      timeout: 10_000,
    })
  })

  test('avatar: pré-visualização, envio, tipo inválido, arquivo grande e remoção', async ({
    page,
  }) => {
    const fileInput = page.locator('#avatar-file')
    const chooseButton = page.getByRole('button', { name: 'Alterar' })

    await fileInput.setInputFiles({ name: 'avatar.gif', mimeType: 'image/gif', buffer: tinyPng })
    await expect(page.getByRole('alert').filter({ hasText: 'Envie uma imagem PNG' })).toBeVisible()
    await expect(chooseButton).toHaveAccessibleDescription(
      'Envie uma imagem PNG, JPEG ou WebP. PNG, JPEG ou WebP, até 1 MB.',
    )

    const big = Buffer.concat([tinyPng, Buffer.alloc(1024 * 1024)])
    await fileInput.setInputFiles({ name: 'grande.png', mimeType: 'image/png', buffer: big })
    await expect(page.getByRole('alert').filter({ hasText: 'até 1 MB' })).toHaveText(
      'A imagem precisa ter até 1 MB.',
    )

    await fileInput.setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: tinyPng })
    await expect(page.getByRole('img', { name: 'Pré-visualização do novo avatar' })).toBeVisible()
    await expect(page.getByRole('alert').filter({ hasText: 'imagem' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Enviar novo avatar' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Avatar atualizado.' })).toBeVisible()
    await expect(page.getByRole('img', { name: 'Seu avatar' })).toHaveAttribute(
      'src',
      /^data:image\/png;base64,/,
    )

    await page.reload()
    await expect(page.getByRole('img', { name: 'Seu avatar' })).toBeVisible()
    await page.getByRole('button', { name: 'Remover', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Avatar removido.' })).toBeVisible()
    await expect(page.getByRole('img', { name: 'Seu avatar' })).toHaveCount(0)
  })

  test('troca de senha: senha atual errada, sucesso e login com a nova', async ({ page }) => {
    await page.locator('#password-current').fill('senha-errada')
    await page.locator('#password-new').fill('novaSenha123')
    await page.locator('#password-confirm').fill('novaSenha123')
    await page.getByRole('button', { name: 'Salvar senha' }).click()
    const current = page.locator('#password-current')
    await expect(current).toHaveAttribute('aria-invalid', 'true')
    await expect(current).toHaveAccessibleDescription('A senha atual está incorreta.')
    await expect(current).toBeFocused()

    await current.fill('kurio123')
    await page.getByRole('button', { name: 'Salvar senha' }).click()
    await expect(page.getByTestId('password-status')).toHaveText(
      'Senha alterada. Use a nova senha no próximo login.',
    )
    await expect(current).toHaveValue('')

    await logoutThroughUi(page)
    await page.goto('/login')
    await page.getByLabel('E-mail', { exact: true }).fill('ana@kurio.dev')
    await page.getByLabel('Senha', { exact: true }).fill('kurio123')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible()

    await page.getByLabel('Senha', { exact: true }).fill('novaSenha123')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/$/)
  })
})

test.describe('carteiras', () => {
  test('Bruno cadastra, edita e remove a secundária; endereço validado pela rede', async ({
    page,
  }) => {
    await loginThroughUi(page, 'bruno@kurio.dev')
    await page.goto('/carteiras')
    const secondary = walletSection(page, 'Carteira secundária')
    await expect(secondary).toContainText('Você ainda não adicionou uma carteira secundária.')

    await secondary.getByRole('button', { name: 'Adicionar carteira secundária' }).click()
    await textbox(secondary, 'Apelido da carteira').fill('Phantom do Bruno')
    await secondary.getByRole('combobox', { name: 'Rede' }).selectOption('solana')
    await textbox(secondary, 'Endereço da carteira').fill(
      '0x2C4e6A8b0D1f3E5a7C9b1D3e5F7a9B0c2D4e6F81',
    )
    await secondary
      .getByRole('combobox', { name: 'Tipo de carteira' })
      .selectOption('walletconnect')
    await secondary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expectFieldError(secondary, 'Endereço da carteira', 'Endereço Solana inválido.')

    await secondary.getByRole('combobox', { name: 'Rede' }).selectOption('ethereum')
    await textbox(secondary, 'Endereço da carteira').fill('0x123')
    await secondary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expectFieldError(
      secondary,
      'Endereço da carteira',
      'O endereço precisa começar com 0x e ter 40 caracteres hexadecimais.',
    )

    await secondary.getByRole('combobox', { name: 'Rede' }).selectOption('solana')
    await textbox(secondary, 'Endereço da carteira').fill(
      '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV',
    )
    await secondary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByTestId('secondary-wallet-status')).toHaveText(
      'Carteira secundária salva.',
    )
    const card = page.getByTestId('secondary-wallet-card')
    await expect(card).toContainText('Phantom do Bruno')
    await expect(card).toContainText('Solana · WalletConnect')
    await expect(
      secondary.getByRole('button', { name: 'Editar carteira secundária' }),
    ).toBeFocused()

    // Editar mantém os dados e troca só o que mudou.
    await secondary.getByRole('button', { name: 'Editar carteira secundária' }).click()
    await expect(textbox(secondary, 'Apelido da carteira')).toHaveValue('Phantom do Bruno')
    await textbox(secondary, 'Apelido da carteira').fill('Phantom reserva')
    await secondary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(card).toContainText('Phantom reserva')

    await page.reload()
    await expect(page.getByTestId('secondary-wallet-card')).toContainText('Phantom reserva')

    // Remover pede confirmação.
    await secondary.getByRole('button', { name: 'Remover carteira secundária' }).click()
    await secondary
      .getByRole('group', { name: 'Confirmar remoção' })
      .getByRole('button', { name: 'Remover' })
      .click()
    await expect(page.getByTestId('secondary-wallet-status')).toHaveText(
      'Carteira secundária removida.',
    )
    await expect(secondary).toContainText('Você ainda não adicionou uma carteira secundária.')
    await expect(
      secondary.getByRole('button', { name: 'Adicionar carteira secundária' }),
    ).toBeFocused()
  })

  test('"Igual à carteira principal" copia os dados para a secundária', async ({ page }) => {
    await loginThroughUi(page, 'bruno@kurio.dev')
    await page.goto('/carteiras')
    const secondary = walletSection(page, 'Carteira secundária')
    await secondary.getByRole('checkbox', { name: 'Igual à carteira principal' }).check({
      force: true,
    })

    await expect(textbox(secondary, 'Apelido da carteira')).toHaveValue('Coinbase do Bruno')
    await expect(textbox(secondary, 'Endereço da carteira')).toHaveValue(
      '0x2C4e6A8b0D1f3E5a7C9b1D3e5F7a9B0c2D4e6F81',
    )
    await expect(secondary.getByRole('combobox', { name: 'Rede' })).toHaveValue('polygon')
    await expect(secondary.getByRole('combobox', { name: 'Tipo de carteira' })).toHaveValue(
      'coinbase',
    )
    await expect(page.getByTestId('secondary-wallet-status')).toHaveText(
      'Dados da carteira principal copiados para o formulário.',
    )
    await secondary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByTestId('secondary-wallet-card')).toContainText('Coinbase do Bruno')
  })

  test('conectar, recusa e desconexão da carteira', async ({ page }) => {
    await loginThroughUi(page, 'ana@kurio.dev')
    await page.goto('/carteiras')
    const card = page.getByTestId('primary-wallet-card')
    await expect(card).toContainText('Desconectada')

    await setScenario(page, 'wallet-rejected')
    await card.getByRole('button', { name: 'Conectar carteira Principal' }).click()
    await expect(card.getByRole('alert')).toHaveText('A conexão foi recusada na carteira.')
    await expect(card).toContainText('Desconectada')

    await setScenario(page, 'default')
    await card.getByRole('button', { name: 'Conectar carteira Principal' }).click()
    await expect(card.getByRole('status')).toHaveText('Carteira Principal conectada.')
    await expect(card).toContainText('Conectada')
    await expect(card.getByRole('alert')).toBeEmpty()

    await card.getByRole('button', { name: 'Desconectar' }).click()
    await expect(card.getByRole('status')).toHaveText('Carteira Principal desconectada.')
    await expect(card).toContainText('Desconectada')
  })

  test('conta nova cadastra a principal pelo formulário aberto', async ({ page }) => {
    await callApi(page, 'POST', '/api/auth/register', {
      body: {
        displayName: 'Carla Dias',
        username: 'carla.dias',
        email: 'carla@kurio.dev',
        password: 'segredo123',
      },
    })
    await page.goto('/login')
    await page.getByLabel('E-mail', { exact: true }).fill('carla@kurio.dev')
    await page.getByLabel('Senha', { exact: true }).fill('segredo123')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await page.waitForURL((url) => !url.pathname.startsWith('/login'))
    await page.goto('/carteiras')

    const primary = walletSection(page, 'Carteira principal')
    const secondary = walletSection(page, 'Carteira secundária')
    await expect(secondary).toContainText('Cadastre a carteira principal antes da secundária.')
    await expect(
      secondary.getByRole('checkbox', { name: 'Igual à carteira principal' }),
    ).toBeDisabled()

    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(primary.getByRole('combobox', { name: 'Rede' })).toHaveAccessibleDescription(
      'Selecione uma rede.',
    )
    await textbox(primary, 'Apelido da carteira').fill('MetaMask da Carla')
    await primary.getByRole('combobox', { name: 'Rede' }).selectOption('ethereum')
    await textbox(primary, 'Endereço da carteira').fill(
      '0x9f8E7d6C5b4A39281706f5E4d3C2b1A098765432',
    )
    await primary.getByRole('combobox', { name: 'Tipo de carteira' }).selectOption('metamask')
    await textbox(primary, 'Nome ENS (opcional)').fill('carla')
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByTestId('primary-wallet-card')).toContainText('carla.eth')
    await expect(
      secondary.getByRole('button', { name: 'Adicionar carteira secundária' }),
    ).toBeVisible()
  })
})

test('os dados da Ana nunca aparecem para o Bruno', async ({ page }) => {
  await loginThroughUi(page, 'ana@kurio.dev')
  await page.goto('/carteiras')
  await expect(page.getByTestId('primary-wallet-card')).toContainText(anaPrimaryAddress)
  await page.goto('/perfil')
  await expect(textbox(page, 'Apelido da carteira')).toHaveValue('Cofre da Ana')

  await logoutThroughUi(page)
  await loginThroughUi(page, 'bruno@kurio.dev')
  await page.goto('/perfil')
  await expect(profileEmail(page)).toHaveValue('bruno@kurio.dev')
  await expect(textbox(page, 'Nome de exibição')).toHaveValue('Bruno Costa')
  await expect(textbox(page, 'Apelido da carteira')).toHaveValue('Carteira do Bruno')
  await expect(textbox(page, 'Nome ENS')).toHaveValue('')

  await page.goto('/carteiras')
  const body = page.locator('body')
  await expect(page.getByTestId('primary-wallet-card')).toContainText('Coinbase do Bruno')
  for (const anaData of [anaPrimaryAddress, anaSecondaryAddress, 'anaribeiro', 'Cofre da Ana']) {
    await expect(body).not.toContainText(anaData)
  }
  await expect(page.getByTestId('secondary-wallet-card')).toHaveCount(0)

  const wallets = await callApi(page, 'GET', '/api/wallets', {
    token: await page.evaluate(() => localStorage.getItem('kurio:token') ?? ''),
  })
  expect(JSON.stringify(wallets.body)).not.toContain(anaPrimaryAddress)
})

test('teclado: navegação da conta, foco visível e itens "em breve" sem ação', async ({ page }) => {
  await loginThroughUi(page, 'ana@kurio.dev')
  await page.goto('/perfil')
  const nav = page.getByRole('navigation', { name: 'Menu da conta' })
  const profileLink = nav.getByRole('link', { name: 'Dados do perfil' })
  await expect(profileLink).toHaveAttribute('aria-current', 'page')

  await profileLink.focus()
  await page.keyboard.press('Tab')
  const walletsLink = nav.getByRole('link', { name: 'Carteiras' })
  await expect(walletsLink).toBeFocused()
  await expectFocusVisible(page)
  // Os itens "em breve" recebem foco para mostrar o tooltip, mas Enter não faz nada.
  await page.keyboard.press('Tab')
  const activity = nav.locator('[aria-disabled="true"]', { hasText: 'Atividade' })
  await expect(activity).toBeFocused()
  await expect(activity.getByText('Em breve', { exact: true })).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/perfil$/)
  await expect(nav.getByText('Suporte')).toHaveAttribute('aria-disabled', 'true')
  await expect(nav.getByText('Suporte')).toContainText('(em breve)')

  await walletsLink.press('Enter')
  await expect(page).toHaveURL(/\/carteiras$/)
  await expect(nav.getByRole('link', { name: 'Carteiras' })).toHaveAttribute('aria-current', 'page')

  // Checkbox do Figma pelo teclado: Espaço marca e o anel de foco aparece no círculo.
  const copy = page.getByRole('checkbox', { name: 'Igual à carteira principal' })
  await copy.focus()
  await page.keyboard.press('Space')
  await expect(copy).toBeChecked()
  await expectFocusVisible(page)

  // Enter dentro do formulário do perfil salva.
  await page.goto('/perfil')
  await textbox(page, 'Nome de exibição').fill('Ana Ribeiro')
  await textbox(page, 'Nome de exibição').press('Enter')
  await expect(page.getByTestId('profile-status')).toHaveText('Perfil salvo.')
})
