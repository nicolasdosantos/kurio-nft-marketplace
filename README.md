# Kurio — Marketplace de NFTs

Marketplace de NFTs feito como desafio de frontend: catálogo com busca e filtros, detalhe, carrinho com cupom, checkout com carteira simulada, comprovante, perfil e carteiras. Não existe backend: a API REST, a autenticação e o tempo real (Socket.IO) são simulados no navegador pelo MSW, com estado persistido, cenários de falha e uma API de controle para os testes.

**Demo:** https://kurio-nft-marketplace-eta.vercel.app (o build publicado roda com os mocks ligados).

Decisões de arquitetura, contratos, limitações e desvios do Figma estão no [ARCHITECTURE.md](./ARCHITECTURE.md).

## Stack

- React 19, TypeScript, Vite
- TanStack Router (rotas por arquivo) e TanStack Query
- Axios para REST e `socket.io-client` para tempo real
- Tailwind CSS 4 com os tokens do Figma e componentes do shadcn/ui (Radix)
- react-hook-form e zod (os mesmos schemas validam formulários e as requisições nos mocks)
- MSW 2 com `@mswjs/socket.io-binding`
- Playwright (E2E, regressão visual e axe) e Lighthouse (`@lhci/cli`)

## Setup a partir de um checkout limpo

Requisitos: Node 20 ou mais novo (o projeto usa 24 LTS), Git, e Docker se for rodar a regressão visual.

```bash
git clone https://github.com/nicolasdosantos/kurio-nft-marketplace.git
cd kurio-nft-marketplace

corepack enable                  # usa o pnpm fixado em "packageManager" (11.24.0)
pnpm install --frozen-lockfile
pnpm exec playwright install chromium

pnpm dev                         # http://localhost:5173
```

O Docker só é usado por `pnpm test:visual`: as capturas dependem das fontes e da renderização do sistema, então elas são geradas e comparadas sempre dentro da imagem oficial do Playwright (`mcr.microsoft.com/playwright:v1.64.0-noble`). Não precisa instalar mais nada: o script baixa a imagem na primeira execução.

Para o Lighthouse no Linux é preciso um Chrome instalado. O script procura `/usr/bin/google-chrome-stable`; em outro caminho, defina `CHROME_PATH`.

## Variáveis de ambiente

O `.env` versionado já tem os valores usados no deploy. Não há segredos.

| Variável            | Padrão | Para que serve                                                                                                                                                                                                    |
| ------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_ENABLE_MOCKS` | `true` | Liga o MSW (API REST e Socket.IO simulados). Fica ligado também no build de produção, porque o deploy é a demonstração. Com `false`, o app chama `/api` e o socket de verdade, que não existem neste repositório. |
| `VITE_SOCKET_URL`   | vazio  | Endereço do Socket.IO. Vazio = mesma origem da página, que é o que o MSW intercepta.                                                                                                                              |

Variáveis só dos scripts (opcionais):

| Variável          | Usada por         | Para que serve                                                                        |
| ----------------- | ----------------- | ------------------------------------------------------------------------------------- |
| `BASE_URL`        | Playwright        | Roda os testes contra um deploy em vez de subir o preview local (ex.: a URL da demo). |
| `LIGHTHOUSE_URL`  | `pnpm lighthouse` | Endereço auditado. Padrão: a URL pública.                                             |
| `LIGHTHOUSE_RUNS` | `pnpm lighthouse` | Medições por página e perfil. Padrão: 3.                                              |
| `CHROME_PATH`     | `pnpm lighthouse` | Caminho do Chrome, se não estiver em `/usr/bin/google-chrome-stable`.                 |

## Contas e cupons de teste

Todos os dados são fictícios e voltam ao estado inicial com o reset dos mocks.

| Usuário     | E-mail            | Senha      | O que tem                                                                                             |
| ----------- | ----------------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| Ana Ribeiro | `ana@kurio.dev`   | `kurio123` | Carteira principal (MetaMask, Ethereum) e reserva (Coinbase, Polygon), 3 favoritos e um pedido antigo |
| Bruno Costa | `bruno@kurio.dev` | `kurio123` | Só a carteira principal (Coinbase, Polygon) e 1 favorito                                              |

| Cupom          | Efeito                                   |
| -------------- | ---------------------------------------- |
| `KURIO10`      | 10% de desconto                          |
| `LANCAMENTO5`  | 5% de desconto                           |
| `EXPIRADO20`   | vencido: a API responde `COUPON_EXPIRED` |
| qualquer outro | `COUPON_INVALID`                         |

O cadastro funciona com qualquer e-mail e nome de usuário livres; `ana@kurio.dev` e `ana.ribeiro` mostram o erro de conflito.

## Cenários dos mocks

O comportamento da API simulada é definido pelo cenário ativo. Ele fica salvo no `localStorage` (`kurio:mock-scenario`) até ser trocado ou resetado.

### Como escolher

- **Pela URL:** `?scenario=<nome>` em qualquer página, ex.: `/?scenario=slow`.
- **Pelo painel:** abra com `?mockPanel=1` ou `Ctrl+Shift+M`. Ele troca o cenário, reseta os dados, expira sessões e desconecta carteiras.
- **Pela API de controle** (é o que os testes usam; rode no console do navegador, na própria página, onde o MSW está ativo):

```js
await fetch('/api/mock-control/scenario', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'payment-declined' }),
})
```

### Como resetar

Pelo painel ("Resetar dados") ou com `POST /api/mock-control/reset`. O reset restaura o banco simulado (usuários, catálogo, carrinhos, pedidos, carteiras), volta para o cenário `default` e limpa as falhas por rota.

### Cenários disponíveis e como reproduzir cada falha

| Cenário                        | O que acontece                                               | Como ver na interface                                                        |
| ------------------------------ | ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `default`                      | Latência de 150 ms, pagamento confirmado em 2 s              | Fluxo normal                                                                 |
| `slow`                         | Toda resposta leva 2,5 s                                     | Skeletons do catálogo, do detalhe e do carrinho                              |
| `variable-latency`             | 200 ms a 2 s, sequência reproduzível                         | Navegar e filtrar o catálogo                                                 |
| `out-of-order`                 | Na listagem, respostas antigas chegam depois das novas       | Trocar filtros rápido: a tela fica com o último pedido                       |
| `timeout`                      | As requisições nunca respondem (o cliente desiste em 10 s)   | Erro com "Tentar de novo" em qualquer tela                                   |
| `offline`                      | Falha de conexão em tudo                                     | Idem                                                                         |
| `server-error`                 | 500 nas leituras e 503 nas escritas                          | Erro e recuperação no catálogo, detalhe e carrinho                           |
| `session-expired`              | Rotas autenticadas respondem 401                             | Logado, abra o perfil: volta ao login com "Sua sessão expirou"               |
| `price-changed-at-checkout`    | O preço sobe ao confirmar a compra                           | No pagamento, "Confirmar compra" mostra o que mudou e pede nova confirmação  |
| `edition-sold-out-at-checkout` | A edição esgota ao confirmar                                 | Idem, com o item esgotado                                                    |
| `order-timeout`                | O pedido é criado, mas a primeira resposta se perde          | A compra se recupera sozinha com a mesma `Idempotency-Key`                   |
| `payment-declined`             | O pagamento é recusado                                       | "Pagamento recusado" com o motivo e o caminho de volta                       |
| `payment-pending`              | O pedido fica pendente até ser liberado pela API de controle | "Pagamento pendente"; libere com `POST /api/mock-control/orders/<id>/settle` |
| `wallet-rejected`              | A carteira recusa a conexão                                  | "Conectar" no pagamento ou em Carteiras mostra a recusa                      |
| `wallet-disconnects`           | A carteira desconecta na hora do pedido                      | O pagamento pede para conectar de novo                                       |

Outras situações pela API de controle (`/api/mock-control`):

| Requisição                                                  | Efeito                                                                                                                                |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /faults {method, path, status, times}`                | Falha só numa rota, ex.: `{"method":"PUT","path":"/api/favorites/:nftId","status":500}` para ver o favorito voltar ao estado anterior |
| `POST /expire-sessions`                                     | Vence todas as sessões                                                                                                                |
| `POST /wallets/disconnect`                                  | Desconecta todas as carteiras                                                                                                         |
| `POST /nfts/:id {priceEth}` ou `{editionId, stock}`         | Muda preço ou estoque e emite `nft.updated` pelo socket (com o NFT no carrinho, a interface avisa)                                    |
| `POST /nfts/:id/replay-event {which: "last" \| "previous"}` | Reenvia um evento repetido ou antigo (o cliente ignora)                                                                               |
| `POST /orders/:id/settle`                                   | Resolve agora um pedido pendente                                                                                                      |
| `POST /orders/:id/replay-event {which}`                     | Reenvia um `order.updated` repetido ou antigo                                                                                         |
| `POST /realtime/offline` e `/realtime/online`               | Derruba e devolve o socket (na volta, o app revalida o que está na tela)                                                              |

## Comandos

| Comando                             | O que faz                                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `pnpm dev`                          | Desenvolvimento com os mocks (http://localhost:5173)                                                   |
| `pnpm build`                        | Gera as rotas, checa os tipos e faz o build de produção em `dist/`                                     |
| `pnpm preview`                      | Serve o build (http://localhost:4173)                                                                  |
| `pnpm typecheck`                    | Gera as rotas e roda o `tsc`                                                                           |
| `pnpm lint`                         | ESLint                                                                                                 |
| `pnpm format` / `pnpm format:check` | Prettier                                                                                               |
| `pnpm test` ou `pnpm test:e2e`      | Testes Playwright (sobe `build` + `preview` na porta 4173); com `BASE_URL=<url>` roda contra um deploy |
| `pnpm test:e2e:ui`                  | Playwright em modo UI                                                                                  |
| `pnpm test:e2e:report`              | Abre o relatório HTML da última execução (traces das falhas incluídos)                                 |
| `pnpm test:visual`                  | Regressão visual dentro do Docker                                                                      |
| `pnpm test:visual:update`           | Regrava as baselines visuais no Docker (só quando o visual mudou de propósito)                         |
| `pnpm lighthouse`                   | Auditoria Lighthouse da URL pública e grava a mediana em `lighthouse/`                                 |

Os testes rodam no Chromium, em dois projetos: desktop (1440×900) e mobile (Pixel 7, 390×844). Cada teste começa com o reset dos mocks. As capturas em `e2e/app/*-snapshots/` são as baselines da regressão visual: imagens do próprio app, versionadas para o `pnpm test:visual` comparar.

## Lighthouse

Início e Detalhe, perfis mobile (4G simulado) e desktop, 3 medições cada contra a URL pública, mediana de cada métrica. Resultado completo em [`lighthouse/resultados.md`](./lighthouse/resultados.md); para refazer, `pnpm lighthouse`.

| Página  | Perfil  | Performance | Accessibility | Best Practices | SEO |    LCP | CLS |   TBT |
| ------- | ------- | ----------: | ------------: | -------------: | --: | -----: | --: | ----: |
| Início  | mobile  |          96 |           100 |            100 | 100 | 2,40 s |   0 | 67 ms |
| Início  | desktop |         100 |           100 |            100 | 100 | 0,56 s |   0 |  0 ms |
| Detalhe | mobile  |          91 |           100 |            100 | 100 | 3,17 s |   0 | 46 ms |
| Detalhe | desktop |         100 |           100 |            100 | 100 | 0,66 s |   0 |  0 ms |

O Detalhe no mobile é o mais lento porque a imagem de LCP só pode ser pedida depois que a API simulada responde, e antes disso o navegador baixa o worker do MSW. A análise está no ARCHITECTURE.md.
