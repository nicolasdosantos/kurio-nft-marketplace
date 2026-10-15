import { defineConfig, devices } from '@playwright/test'

const PORT = 4173

// Com BASE_URL os testes rodam contra um deploy (ex.: a URL da Vercel) em vez do preview local.
const externalBaseUrl = process.env.BASE_URL

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Contra o deploy cada teste abre o site sem cache e baixa tudo (inclusive o worker do
  // MSW) pela internet; com a suíte em paralelo, só o beforeEach pode passar de 15s.
  timeout: externalBaseUrl ? 60_000 : 30_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  // Sem o sistema no nome: as baselines são geradas sempre no Docker (pnpm test:visual:update).
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}',
  use: {
    baseURL: externalBaseUrl ?? `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-chromium',
      // Os testes da API simulada não dependem do viewport.
      testIgnore: '**/api/**',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
    },
  ],
  // Roda contra o build de produção, com os mocks ligados.
  webServer: externalBaseUrl
    ? undefined
    : {
        command: `pnpm build && pnpm preview --port ${PORT} --strictPort`,
        port: PORT,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
})
