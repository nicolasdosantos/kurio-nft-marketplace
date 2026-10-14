# Kurio — Marketplace de NFTs

Marketplace de NFTs em React + TypeScript com APIs, autenticação e tempo real simulados com MSW.

Demo: https://kurio-nft-marketplace-eta.vercel.app

> Em desenvolvimento. Este README vai ganhar setup completo, cenários dos mocks e credenciais de teste.

## Rodando localmente

Requer Node 20+ e pnpm.

```bash
pnpm install
pnpm dev
```

## Scripts

| Comando           | O que faz                                                            |
| ----------------- | -------------------------------------------------------------------- |
| `pnpm dev`        | servidor de desenvolvimento com mocks                                |
| `pnpm build`      | build de produção                                                    |
| `pnpm preview`    | serve o build localmente                                             |
| `pnpm typecheck`  | verificação de tipos                                                 |
| `pnpm lint`       | ESLint                                                               |
| `pnpm test:e2e`   | testes Playwright (use `BASE_URL=<url>` para rodar contra um deploy) |
| `pnpm lighthouse` | auditoria Lighthouse                                                 |
