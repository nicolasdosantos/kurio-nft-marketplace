// Auditoria Lighthouse reproduzível: Início e Detalhe, mobile e desktop, 3 medições cada,
// contra a URL pública (build otimizado da Vercel, cenário padrão dos mocks).
// Grava a mediana de cada métrica em lighthouse/resultados.md e lighthouse/resultados.json.
//
// uso: pnpm lighthouse            (URL pública)
//      LIGHTHOUSE_URL=http://localhost:4173 pnpm lighthouse   (outro endereço, ex.: preview)
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const baseUrl = (
  process.env.LIGHTHOUSE_URL ?? 'https://kurio-nft-marketplace-eta.vercel.app'
).replace(/\/$/, '')
const runs = Number(process.env.LIGHTHOUSE_RUNS ?? 3)
const pages = [
  { name: 'Início', path: '/' },
  { name: 'Detalhe', path: '/nft/emerald-ape-042' },
]
const profiles = [
  { name: 'mobile', flags: [] },
  { name: 'desktop', flags: ['--settings.preset=desktop'] },
]

// O chrome-launcher do Lighthouse precisa saber onde está o Chrome no Linux.
const env = { ...process.env }
if (!env.CHROME_PATH && existsSync('/usr/bin/google-chrome-stable')) {
  env.CHROME_PATH = '/usr/bin/google-chrome-stable'
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

const results = []
for (const page of pages) {
  for (const profile of profiles) {
    const outputDir = join('.lighthouseci', `${profile.name}-${page.path.replace(/\W+/g, '_')}`)
    rmSync(outputDir, { recursive: true, force: true })
    console.log(`Lighthouse ${page.name} (${profile.name}), ${runs} medições...`)
    execFileSync(
      'pnpm',
      [
        'exec',
        'lhci',
        'collect',
        `--url=${baseUrl}${page.path}`,
        `--numberOfRuns=${runs}`,
        '--settings.chromeFlags=--headless=new',
        ...profile.flags,
      ],
      // No Windows o pnpm é um .cmd, que o execFileSync só acha pelo shell.
      { stdio: 'inherit', env, shell: process.platform === 'win32' },
    )
    // O lhci grava em .lighthouseci/; cada combinação vai para a própria pasta.
    mkdirSync(outputDir, { recursive: true })
    const reports = readdirSync('.lighthouseci')
      .filter((file) => file.startsWith('lhr-') && file.endsWith('.json'))
      .map((file) => {
        const content = readFileSync(join('.lighthouseci', file), 'utf8')
        writeFileSync(join(outputDir, file), content)
        rmSync(join('.lighthouseci', file))
        rmSync(join('.lighthouseci', file.replace('.json', '.html')), { force: true })
        return JSON.parse(content)
      })

    const score = (report, category) => Math.round(report.categories[category].score * 100)
    const audit = (report, id) => report.audits[id].numericValue
    results.push({
      page: page.name,
      profile: profile.name,
      url: `${baseUrl}${page.path}`,
      runs: reports.length,
      performance: median(reports.map((report) => score(report, 'performance'))),
      accessibility: median(reports.map((report) => score(report, 'accessibility'))),
      bestPractices: median(reports.map((report) => score(report, 'best-practices'))),
      seo: median(reports.map((report) => score(report, 'seo'))),
      lcpMs: Math.round(median(reports.map((report) => audit(report, 'largest-contentful-paint')))),
      cls: Number(
        median(reports.map((report) => audit(report, 'cumulative-layout-shift'))).toFixed(3),
      ),
      tbtMs: Math.round(median(reports.map((report) => audit(report, 'total-blocking-time')))),
    })
  }
}

mkdirSync('lighthouse', { recursive: true })
const measuredAt = new Date().toISOString()
writeFileSync(
  'lighthouse/resultados.json',
  `${JSON.stringify({ measuredAt, baseUrl, runs, results }, null, 2)}\n`,
)

const rows = results.map(
  (row) =>
    `| ${row.page} | ${row.profile} | ${row.performance} | ${row.accessibility} | ${row.bestPractices} | ${row.seo} | ${(row.lcpMs / 1000).toFixed(2)} s | ${row.cls} | ${row.tbtMs} ms |`,
)
const markdown = [
  `# Lighthouse — mediana de ${runs} medições`,
  '',
  `Medido em ${measuredAt} contra ${baseUrl} (Lighthouse do @lhci/cli; mobile = perfil padrão com 4G simulado, desktop = preset desktop).`,
  '',
  '| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |',
  '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ...rows,
  '',
]
writeFileSync('lighthouse/resultados.md', markdown.join('\n'))
console.log(markdown.join('\n'))
