// Roda o Playwright dentro da imagem oficial, na mesma versão do @playwright/test.
// Assim as capturas da regressão visual saem iguais em qualquer máquina (Linux,
// macOS ou Windows), porque fontes e renderização vêm sempre do mesmo sistema.
//
// Uso: node scripts/playwright-docker.mjs [argumentos do playwright test]
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { version } = JSON.parse(
  readFileSync(require.resolve('@playwright/test/package.json'), 'utf8'),
)
const image = `mcr.microsoft.com/playwright:v${version}-noble`
const playwrightArgs = process.argv.slice(2).map((arg) => `'${arg.replaceAll("'", "'\\''")}'`)

// No Linux e no macOS os arquivos gerados voltam para o usuário de fora do container.
const giveBackFiles =
  typeof process.getuid === 'function'
    ? `chown -R ${process.getuid()}:${process.getgid()} dist test-results playwright-report e2e public 2>/dev/null`
    : 'true'

const insideContainer = [
  'corepack enable',
  // O store fica no volume; sem isso o pnpm cria um .pnpm-store dentro do projeto.
  'pnpm install --frozen-lockfile --store-dir /pnpm-store',
  `pnpm exec playwright test ${playwrightArgs.join(' ')}`,
].join(' && ')

const result = spawnSync(
  'docker',
  [
    'run',
    '--rm',
    '--ipc=host',
    '-v',
    `${process.cwd()}:/work`,
    // node_modules e o store do pnpm ficam em volumes: o node_modules da máquina não é tocado.
    '-v',
    'kurio-playwright-node-modules:/work/node_modules',
    '-v',
    'kurio-playwright-pnpm-store:/pnpm-store',
    '-w',
    '/work',
    '-e',
    'COREPACK_ENABLE_DOWNLOAD_PROMPT=0',
    '-e',
    'PLAYWRIGHT_DOCKER=1',
    image,
    'bash',
    '-c',
    `${insideContainer}; status=$?; ${giveBackFiles}; exit $status`,
  ],
  { stdio: 'inherit' },
)

process.exit(result.status ?? 1)
