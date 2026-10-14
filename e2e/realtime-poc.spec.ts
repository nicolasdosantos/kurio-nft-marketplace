import { expect, test } from '@playwright/test'

test.describe('PoC de tempo real (MSW + Socket.IO)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/poc/nft-1')
    await expect(page.getByTestId('nft-price')).toHaveText('1.99 ETH')
    await expect(page.getByTestId('socket-status')).toHaveText('conectado')
  })

  test('evento nft.updated chega pelo socket e atualiza o preço', async ({ page }) => {
    await page.getByRole('button', { name: 'Aumentar preço no servidor' }).click()

    await expect(page.getByTestId('nft-price')).toHaveText('2.09 ETH')
    await expect(page.getByTestId('nft-version')).toHaveText('2')
    await expect(page.getByTestId('event-log').getByRole('listitem').first()).toHaveText(
      /v2 · 2\.09 ETH · aplicado/,
    )
  })

  test('evento duplicado ou antigo é ignorado', async ({ page }) => {
    const raisePrice = page.getByRole('button', { name: 'Aumentar preço no servidor' })
    await raisePrice.click()
    await expect(page.getByTestId('nft-version')).toHaveText('2')
    await raisePrice.click()
    await expect(page.getByTestId('nft-version')).toHaveText('3')

    const logItems = page.getByTestId('event-log').getByRole('listitem')

    await page.getByRole('button', { name: 'Reenviar último evento' }).click()
    await expect(logItems.first()).toHaveText(/v3 · 2\.19 ETH · ignorado/)

    await page.getByRole('button', { name: 'Enviar evento antigo' }).click()
    await expect(logItems.first()).toHaveText(/v2 · 2\.09 ETH · ignorado/)

    await expect(page.getByTestId('nft-price')).toHaveText('2.19 ETH')
    await expect(page.getByTestId('nft-version')).toHaveText('3')
  })

  test('após reconectar, busca o estado de novo via REST', async ({ page }) => {
    await page.getByRole('button', { name: 'Derrubar conexão' }).click()
    await expect(page.getByTestId('socket-status')).toHaveText('desconectado')

    // Mudança feita enquanto o cliente está offline: o evento se perde.
    await page.getByRole('button', { name: 'Aumentar preço no servidor' }).click()
    await expect(page.getByTestId('nft-price')).toHaveText('1.99 ETH')

    const refetch = page.waitForResponse(
      (response) => response.url().endsWith('/api/nfts/nft-1') && response.status() === 200,
    )
    await page.getByRole('button', { name: 'Restaurar conexão' }).click()

    // O cliente está em backoff de reconexão (até ~4,5s com o jitter do socket.io).
    await expect(page.getByTestId('socket-status')).toHaveText('conectado', { timeout: 10_000 })
    await refetch
    await expect(page.getByTestId('nft-price')).toHaveText('2.09 ETH')
    await expect(page.getByTestId('nft-version')).toHaveText('2')
  })

  test('refresh em rota interna e NFT inexistente', async ({ page }) => {
    await page.reload()
    await expect(page.getByTestId('nft-price')).toHaveText('1.99 ETH')

    await page.goto('/poc/nao-existe')
    await expect(page.getByText('NFT não encontrado.')).toBeVisible()
  })
})
