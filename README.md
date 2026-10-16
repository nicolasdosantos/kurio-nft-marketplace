# Kurio — Marketplace de NFTs

Um marketplace de NFTs feito como desafio de frontend. Tem catálogo com busca e filtros, detalhe do NFT, carrinho com cupom, checkout com carteira simulada, comprovante, perfil e carteiras.

Não tem backend. A API REST, o login e o tempo real (Socket.IO) são simulados no próprio navegador com MSW, com dados que persistem no refresh, cenários de falha e uma API de controle usada nos testes.

Demo: https://kurio-nft-marketplace-eta.vercel.app (o deploy roda com os mocks ligados).

Como o projeto está organizado, os contratos da API, as animações e as decisões que tomei estão no [ARCHITECTURE.md](./ARCHITECTURE.md).

## Stack

React 19 e TypeScript com Vite, TanStack Router e TanStack Query, Axios e `socket.io-client`, Tailwind CSS 4 com os componentes do shadcn/ui, react-hook-form e zod, MSW 2 com `@mswjs/socket.io-binding`, Playwright e Lighthouse.

As animações são só CSS (Tailwind e `tw-animate-css`), mexem apenas em `transform` e `opacity` e ficam desligadas para quem usa `prefers-reduced-motion`.

## Rodando do zero

Você precisa de Node 20 ou mais novo (uso o 24) e Git. O Docker só é necessário para a regressão visual.

```bash
git clone https://github.com/nicolasdosantos/kurio-nft-marketplace.git
cd kurio-nft-marketplace

corepack enable                  # ativa o pnpm na versão do package.json
pnpm install --frozen-lockfile
pnpm exec playwright install chromium

pnpm dev                         # http://localhost:5173
```

A regressão visual roda dentro da imagem oficial do Playwright, porque as capturas mudam com as fontes e a renderização de cada sistema. Com Docker instalado, `pnpm test:visual` baixa a imagem na primeira vez e faz o resto. Sem Docker, nada quebra: no `pnpm test` esses testes aparecem como pulados, com o aviso "regressão visual roda no Docker". As baselines também podem ser conferidas ou regravadas pelo workflow manual "Baselines visuais" do GitHub Actions (mesma imagem): o modo `atualizar` publica as capturas novas como artifact, para conferir e commitar à mão.

Para o Lighthouse no Linux é preciso ter o Chrome instalado. O script procura em `/usr/bin/google-chrome-stable`; se estiver em outro lugar, defina `CHROME_PATH`.

## Variáveis de ambiente

O `.env` versionado já vem com o que o deploy usa e não tem nenhum segredo.

- `VITE_ENABLE_MOCKS=true` liga o MSW. Fica ligado também em produção, porque o deploy é a demonstração. Com `false`, o app tenta falar com uma API e um socket de verdade, que não existem neste repositório.
- `VITE_SOCKET_URL` é o endereço do Socket.IO. Vazio significa a mesma origem da página, que é o que o MSW intercepta.

Os scripts aceitam mais algumas, todas opcionais: `BASE_URL` roda o Playwright contra um deploy em vez do preview local; `LIGHTHOUSE_URL` e `LIGHTHOUSE_RUNS` mudam o endereço e o número de medições do Lighthouse; `CHROME_PATH` aponta o Chrome.

## Contas e cupons de teste

As duas contas usam a senha `kurio123`:

- `ana@kurio.dev` (Ana Ribeiro): carteira principal MetaMask na Ethereum e reserva Coinbase na Polygon, 3 favoritos e um pedido antigo. É a melhor para testar a compra.
- `bruno@kurio.dev` (Bruno Costa): só a carteira principal, Coinbase na Polygon, e 1 favorito.

Cupons: `KURIO10` (10%), `LANCAMENTO5` (5%) e `EXPIRADO20`, que mostra o erro de cupom vencido. Qualquer outro código é inválido.

Dá para criar conta nova pelo cadastro. Usar `ana@kurio.dev` ou `ana.ribeiro` mostra o erro de e-mail ou usuário em uso.

## Cenários dos mocks

O cenário ativo define como a API simulada se comporta. Ele fica salvo no navegador até você trocar ou resetar. Há três jeitos de escolher:

- pela URL, com `?scenario=<nome>` em qualquer página (ex.: `/?scenario=slow`);
- pelo painel de simulação, que abre com `?mockPanel=1` ou `Ctrl+Shift+M` e também reseta os dados, expira sessões e desconecta carteiras;
- pela API de controle, que é o que os testes usam. Rode no console do navegador, na própria página:

```js
await fetch('/api/mock-control/scenario', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'payment-declined' }),
})
```

Para voltar ao estado inicial, use "Resetar dados" no painel ou `POST /api/mock-control/reset`. O reset restaura usuários, catálogo, carrinhos, pedidos e carteiras, volta ao cenário `default` e limpa as falhas injetadas.

Os cenários e como ver cada falha na tela:

- `default`: tudo normal, respostas em 150 ms e pagamento confirmado em 2 s.
- `slow`: toda resposta leva 2,5 s. Bom para ver os skeletons do catálogo, do detalhe e do carrinho.
- `variable-latency`: respostas entre 200 ms e 2 s, sempre na mesma sequência.
- `out-of-order`: na listagem, respostas antigas chegam depois das novas. Troque os filtros rápido e veja que a tela fica com o último pedido.
- `timeout`: nada responde e o app desiste em 10 s, mostrando o erro com "Tentar de novo".
- `offline`: falha de conexão em tudo.
- `server-error`: 500 nas leituras e 503 nas escritas.
- `session-expired`: as rotas logadas respondem 401. Logado, abra o perfil e você volta ao login com "Sua sessão expirou".
- `price-changed-at-checkout` e `edition-sold-out-at-checkout`: o preço sobe ou a edição esgota na hora de confirmar. O pagamento mostra o que mudou e pede nova confirmação.
- `order-timeout`: o pedido é criado mas a primeira resposta se perde. A compra se recupera sozinha, sem duplicar.
- `payment-declined`: o pagamento é recusado e a tela mostra o motivo e o caminho de volta.
- `payment-pending`: o pedido fica pendente até você liberar com `POST /api/mock-control/orders/<id>/settle`.
- `wallet-rejected`: a carteira recusa a conexão, no pagamento ou em Carteiras.
- `wallet-disconnects`: a carteira desconecta na hora do pedido e o pagamento pede para conectar de novo.

A API de controle (`/api/mock-control`) também permite:

- `POST /faults {method, path, status, times}`: falhar só uma rota. Por exemplo `{"method":"PUT","path":"/api/favorites/:nftId","status":500}` para ver o favorito voltar ao estado anterior.
- `POST /expire-sessions` e `POST /wallets/disconnect`.
- `POST /nfts/:id` com `{priceEth}` ou `{editionId, stock}`: muda preço ou estoque e avisa pelo socket. Com o NFT no carrinho, a interface mostra a mudança.
- `POST /nfts/:id/replay-event` e `POST /orders/:id/replay-event` com `{which: "last" | "previous"}`: reenviam um evento repetido ou antigo, que o app ignora.
- `POST /orders/:id/settle`: resolve agora um pedido pendente.
- `POST /realtime/offline` e `/realtime/online`: derrubam e devolvem o socket. Na volta, o app busca de novo o que está na tela.

## Comandos

```bash
pnpm dev                  # desenvolvimento com os mocks
pnpm build                # gera as rotas, checa os tipos e faz o build em dist/
pnpm preview              # serve o build em http://localhost:4173
pnpm typecheck            # só o tsc
pnpm lint                 # ESLint
pnpm format               # Prettier (format:check só confere)
pnpm test                 # testes Playwright (o mesmo que test:e2e)
pnpm test:e2e:ui          # Playwright em modo UI
pnpm test:e2e:report      # relatório HTML da última execução, com os traces das falhas
pnpm test:visual          # regressão visual no Docker
pnpm test:visual:update   # regrava as baselines (só quando o visual mudou de propósito)
pnpm lighthouse           # Lighthouse da URL pública, resultado em lighthouse/
```

O `pnpm test` sobe o build e o preview sozinho. Com `BASE_URL=<url>` ele roda contra um deploy. Os testes rodam no Chromium em dois tamanhos, desktop (1440×900) e celular (Pixel 7, 390×844), e cada um começa com os mocks resetados. As imagens em `e2e/app/*-snapshots/` são as baselines da regressão visual: capturas do próprio app que o `pnpm test:visual` usa para comparar.

## Lighthouse

Início e Detalhe, no celular (4G simulado) e no desktop, 3 medições cada contra a URL pública. Os números são a mediana; o resultado completo fica em [`lighthouse/resultados.md`](./lighthouse/resultados.md) e dá para refazer com `pnpm lighthouse`.

| Página  | Perfil  | Performance | Accessibility | Best Practices | SEO |    LCP | CLS |   TBT |
| ------- | ------- | ----------: | ------------: | -------------: | --: | -----: | --: | ----: |
| Início  | mobile  |          96 |           100 |            100 | 100 | 2,40 s |   0 | 67 ms |
| Início  | desktop |         100 |           100 |            100 | 100 | 0,56 s |   0 |  0 ms |
| Detalhe | mobile  |          91 |           100 |            100 | 100 | 3,17 s |   0 | 46 ms |
| Detalhe | desktop |         100 |           100 |            100 | 100 | 0,66 s |   0 |  0 ms |

O Detalhe no celular é o mais lento porque a imagem principal só pode ser pedida depois que a API simulada responde, e antes disso o navegador precisa baixar o worker do MSW. Explico melhor no ARCHITECTURE.md.
