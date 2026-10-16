# Arquitetura

Como o app está organizado, os contratos da API simulada, as decisões de estado e tempo real, a estratégia de testes, as limitações conhecidas e os desvios em relação ao Figma. Setup e comandos estão no [README](./README.md).

## Estrutura de pastas

```
src/
  main.tsx, app.tsx     entrada: QueryClient, router, início do MSW depois da primeira pintura
  routes/               rotas do TanStack Router (uma por arquivo; routeTree.gen.ts é gerado)
  pages/                telas: Início, Detalhe, Carrinho, Pagamento, Pedido, Perfil, Carteiras
  components/
    ui/                 componentes do shadcn/ui adaptados aos tokens (Dialog, Sheet, Select...)
    layout/             header, footer, tab bar mobile, menu da conta, "em breve"
    catalog/, home/     cards, filtros, abas, paginação, destaques do Início
    nft/                galeria, seletor de edição, stepper, carrossel, abas do detalhe
    cart/, checkout/    resumo do carrinho, itens, carteiras e painéis do pagamento
    order/              recibo do pedido
    auth/, account/     login e cadastro; layout da conta, avatar, formulário de carteira
    form/               campo com rótulo, erro, select, senha e ENS
  api/
    contracts/          schemas zod de requisições, respostas, erros e eventos
    http.ts, errors.ts  cliente Axios (token, carrinho de visitante, timeout) e ApiRequestError
    *.ts                hooks do TanStack Query por recurso (catalog, cart, orders, account...)
    query-keys.ts       todas as query keys
  session/              store da sessão (token, usuário, restauração)
  realtime/             conexão Socket.IO, aplicação dos eventos no cache e anúncios para leitor de tela
  lib/                  utilidades: guarda de rota, tentativa de compra, comparação de cotações...
  mocks/                camada de mocks (MSW): banco, fixtures, handlers REST, socket, cenários
e2e/
  app/                  testes de interface (desktop e mobile) e baselines visuais (*-snapshots/)
  api/                  testes dos contratos da API simulada
  support/              helpers: chamadas à API de controle, login, foco visível
scripts/                Playwright no Docker e Lighthouse
lighthouse/             últimos resultados da auditoria
```

## Contratos REST

Base `/api`, JSON. Autenticação com `Authorization: Bearer <token>`; o carrinho de visitante é identificado por `X-Cart-Id`. Os corpos são validados no handler com os mesmos schemas de `src/api/contracts/`, que também validam os formulários. Valores em ETH trafegam como string decimal (`"1.19"`), calculados com `decimal.js`; quantidades são inteiras.

### Formato de erro

```json
{
  "error": {
    "code": "EMAIL_TAKEN",
    "message": "Este e-mail já está em uso.",
    "fields": { "email": "..." },
    "details": {}
  }
}
```

| Status  | Códigos                                                                                                                                                               |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400     | `BAD_REQUEST` (JSON inválido, header faltando)                                                                                                                        |
| 401     | `UNAUTHENTICATED`, `SESSION_EXPIRED`, `INVALID_CREDENTIALS`                                                                                                           |
| 403     | `FORBIDDEN` (pedido de outro usuário)                                                                                                                                 |
| 404     | `NOT_FOUND`                                                                                                                                                           |
| 409     | `EMAIL_TAKEN`, `USERNAME_TAKEN`, `OUT_OF_STOCK`, `QUOTE_OUTDATED` (cotação nova em `details.quote`), `IDEMPOTENCY_CONFLICT`, `WALLET_REJECTED`, `WALLET_DISCONNECTED` |
| 422     | `VALIDATION_ERROR` (com `fields`), `COUPON_INVALID`, `COUPON_EXPIRED`, `WRONG_PASSWORD`                                                                               |
| 500/503 | `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`                                                                                                                               |

No cliente, todo erro vira `ApiRequestError`; falha de rede e timeout (10 s) chegam com `status 0`. `fields` vai direto para o campo do formulário (`showFieldErrors`).

### Endpoints

- **Sessão:** `POST /auth/register`, `POST /auth/login` → `{token, expiresAt, user}`; `GET /auth/session`; `POST /auth/logout` (também fecha os sockets daquele token). O token vale 30 min. Login e cadastro aceitam `guestCartId` para mesclar o carrinho de visitante.
- **Catálogo:** `GET /nfts?q&collection&network&minPrice&maxPrice&tab=all|new|trending&sort=recent|price-asc|price-desc|name&page&pageSize` → `{items, page, pageSize, total, totalPages, facets}`. Os facets (contagens por coleção e rede, faixa de preço) são do catálogo inteiro. `GET /nfts/:id` → NFT com descrição, atributos, avaliações, raridade e edições (`1-1`, `1-10`, `1-50`, `open`, cada uma com estoque e máximo por pedido).
- **Favoritos:** `GET /favorites`, `PUT /favorites/:id`, `DELETE /favorites/:id`.
- **Carrinho:** `GET /cart`, `POST /cart/items`, `PATCH /cart/items/:itemId`, `DELETE /cart/items/:itemId`, `PUT /cart/coupon`, `DELETE /cart/coupon`; todos devolvem o carrinho inteiro, com `addedPriceEth` (preço quando o item entrou) para a interface avisar mudança de preço. Quantidade acima de `min(estoque, máximo por pedido)` → 409 `OUT_OF_STOCK`.
- **Cotação:** `POST /quote {network}` → total por linha, desconto, taxa da rede, total e `issues` por linha (`PRICE_CHANGED`, `OUT_OF_STOCK`, `QUANTITY_EXCEEDS_STOCK`). Vale 10 min.
- **Pedidos:** `POST /orders` com `Idempotency-Key` (ver "Checkout e idempotência"); `GET /orders`; `GET /orders/:id` (403 se for de outro usuário). O recibo é uma cópia da cotação no momento da criação e nunca muda. O pedido nasce `pending` e se resolve 2 s depois (`confirmed` ou `declined`, com `failureReason`).
- **Perfil:** `GET /profile`, `PATCH /profile` (409 para e-mail ou usuário em uso), `PUT /profile/avatar {imageDataUrl}` (PNG, JPEG ou WebP até 1 MB), `DELETE /profile/avatar`, `PUT /profile/password` (422 `WRONG_PASSWORD`).
- **Carteiras:** `GET /wallets` → `{primary, secondary}`; `PUT /wallets/primary|secondary` (endereço validado pela rede: `0x` + 40 hex em Ethereum e Polygon, base58 em Solana; a secundária exige a principal); `DELETE /wallets/secondary`; `POST /wallets/:slot/connect {network, walletType?}` (recusa com 409 `WALLET_REJECTED` se o app de conexão não for o da carteira ou no cenário `wallet-rejected`); `POST /wallets/:slot/disconnect`.

## Eventos Socket.IO

O cliente conecta em `<origem>/socket.io` (só websocket) com o token na query. Todo evento tem o formato:

```json
{
  "eventId": "...",
  "type": "nft.updated",
  "resource": { "type": "nft", "id": "emerald-ape-042" },
  "version": 7,
  "occurredAt": "...",
  "data": {}
}
```

| Evento          | Para quem              | `data`                                                  | Efeito no cliente                                                                                                                                |
| --------------- | ---------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `nft.updated`   | todas as conexões      | `priceEth`, `originalPriceEth`, `editions[{id, stock}]` | Atualiza preço e estoque no detalhe e no catálogo; se o NFT está no carrinho, busca de novo carrinho e cotação e anuncia a mudança (`aria-live`) |
| `order.updated` | só as conexões do dono | `status`, `failureReason`                               | Atualiza o pedido e anuncia confirmação ou recusa; o `eventId` é `<orderId>:v<versão>`                                                           |

## Estado no cliente

### Sessão

O token fica no `localStorage` (`kurio:token`) e o usuário num store próprio (`session-store`). Ao abrir o app com um token salvo, a sessão é restaurada com `GET /auth/session`; enquanto isso as requisições esperam (`waitForSessionRestore`), as rotas protegidas aguardam (`requireLogin` é assíncrono) e o dono do cache fica `pending`, para nada privado cair no cache do visitante. Um 401 `SESSION_EXPIRED` no meio da navegação leva ao login com `?expired=true&redirect=<rota>` e, depois de entrar, de volta para onde estava.

### Carrinho do visitante

O visitante ganha um id de carrinho (`kurio:guest-cart-id`) enviado em `X-Cart-Id`. No login ou cadastro esse id vai junto: o servidor soma as quantidades no carrinho da conta (limitando ao estoque) e apaga o carrinho de visitante. Assim, "comprar deslogado, entrar e pagar" mantém os itens.

### Cache e query keys

Tudo passa pelo TanStack Query. Dados públicos ficam em `['nfts', ...]`; tudo que é privado fica embaixo do dono, `['owner', 'user:<id>' | 'guest:<carrinho>', ...]` (carrinho, cotação por rede, favoritos, pedidos, perfil, carteiras). Trocar de usuário troca o prefixo, então nunca há mistura de cache entre contas. As chaves estão em `src/api/query-keys.ts`.

Leituras repetem até 2 vezes em erro de rede ou 5xx. Escritas não repetem sozinhas, com uma exceção: a criação do pedido, que é idempotente.

### Atualização otimista

O favorito muda na hora (`onMutate` grava o novo estado e guarda o anterior); se a requisição falha, o estado anterior volta (`onError`) e a lista é buscada de novo no fim (`onSettled`). O resto (carrinho, perfil, carteiras) espera a resposta do servidor, que devolve o recurso inteiro, e bloqueia os controles durante o envio.

## Reconciliação entre REST e socket

- **Duplicados:** o cliente guarda os `eventId` já aplicados (até 500) e ignora repetições.
- **Antigos:** cada recurso tem `version`. Um evento com versão menor ou igual à que está no cache é ignorado, então um pedido confirmado nunca volta a "pendente".
- **Reconexão:** ao reconectar, o cliente invalida as queries ativas e busca tudo pelo REST: o que mudou enquanto o socket estava fora aparece sem depender de eventos perdidos.
- **Troca de usuário:** a conexão é fechada e aberta de novo com o novo token, e o logout fecha no servidor os sockets daquele token. Eventos da sessão anterior não chegam ao novo usuário.
- **Fallback:** um pedido pendente também é consultado a cada 3 s pelo REST, caso o evento se perca.
- **Ciclo de vida:** listeners são removidos e o socket desconecta ao sair do efeito (`useRealtimeSync`).

## Checkout e idempotência

1. A página de pagamento já é a revisão. A cotação exibida ao abrir (ou ao trocar de carteira/rede) é a "revisada".
2. Se a cotação muda (evento do socket, `QUOTE_OUTDATED` ou revalidação), a tela lista o que mudou (preço por item, estoque, desconto, taxa, total) e o botão vira "Revisar novo total"; se um item esgotou, "Ajustar no carrinho". Uma cotação desatualizada nunca é confirmada.
3. "Confirmar compra" valida o formulário, exige carteira conectada, busca a cotação de novo e, se ela continua igual à revisada, envia o pedido com uma `Idempotency-Key` nova.
4. A tentativa (chave + corpo) fica no `sessionStorage` (`kurio:checkout-attempt`). Os retries automáticos (3, em erro de rede ou 5xx) usam a mesma chave; depois deles, "Tentar de novo" também. No servidor, mesma chave e mesmo corpo devolvem o pedido já criado; mesma chave com outro corpo dá 409.
5. Se a página recarrega no meio do envio, ela reenvia a tentativa guardada e recebe o pedido que já existia. Não há compra duplicada.
6. Com o pedido criado, a tela mostra "Pagamento pendente" até a resolução (socket ou consulta). Confirmado abre o comprovante; recusado mostra o motivo e o caminho de volta.

## Camada de mocks

- **Onde roda:** o MSW intercepta `/api/*` e o Socket.IO no próprio navegador, em desenvolvimento, nos testes e no deploy. Nenhum componente, hook ou cliente Axios tem resposta fictícia: tudo passa pela rede simulada.
- **Banco:** fixtures (45 NFTs, 2 usuários, cupons, um pedido antigo) carregadas num banco em memória, persistido no `localStorage` (`kurio:mock-db:v3`) para sobreviver ao refresh. Senhas guardadas como hash.
- **Regras:** os handlers aplicam as mesmas regras de um backend (validação pelos schemas, estoque, máximo por pedido, cotação com validade, idempotência, isolamento por usuário, resolução do pedido pelo tempo).
- **Cenários:** latência, falhas, timeouts, sessão expirada e as falhas de checkout e carteira (lista no README). O cenário ativo e as falhas por rota ficam no `localStorage` (`kurio:mock-scenario`). A latência variável usa uma seed fixa, então é reproduzível.
- **API de controle:** `/api/mock-control/*` troca cenário, injeta falhas por rota, reseta, expira sessões, muda preço e estoque, libera pedidos pendentes, reenvia eventos e derruba o socket. É usada pelo painel de simulação e pelos testes; as telas não a usam.
- **Início:** o worker sobe depois da primeira pintura, para não disputar a rede com a primeira tela; com um token salvo ele sobe na hora, porque a restauração da sessão depende da API. As requisições esperam o worker (`mocksReady`), e o `<html>` recebe `data-mocks="ready"`.

### Limitações do binding de Socket.IO

- Só websocket, sem long-polling, rooms ou namespaces, e sem ping do servidor.
- O token vai na query string, porque o `auth` do handshake não chega ao mock.
- O `socket.io-client` só pode ser importado depois do `worker.start()`: o engine.io guarda a referência do `WebSocket` global quando o módulo carrega.
- As conexões simuladas não aparecem como WebSocket no DevTools.
- O "offline" da API de controle vive na memória da página: um refresh volta a conectar.

## Estratégia de testes

- **E2E (Playwright, Chromium):** dois projetos, desktop 1440×900 e mobile Pixel 7 390×844; todas as specs de interface rodam nos dois. Cada teste começa com o reset dos mocks, num contexto novo. As verificações olham a interface e o resultado das operações (REST pelos handlers do MSW e tempo real pelo `socket.io-client`, nunca setando o cache direto).
- **Cobertura:** os 12 cenários do enunciado (busca e histórico, detalhe direto e inexistente, sessão, favoritos com falha, carrinho, compra completa, falhas de pagamento e idempotência, perfil e carteiras, socket no checkout, eventos duplicados/antigos e pedido pendente com socket fora, teclado e foco, skeletons e recuperação).
- **Tempo:** `page.clock.install()` com `setSystemTime()` adianta o relógio (sessão de 30 min, cotação de 10 min) sem disparar timers; `fastForward` não é usado porque dispararia o timeout do Axios das requisições em andamento. Latência e falhas vêm dos cenários; eventos são disparados pela API de controle.
- **Regressão visual:** Início, Detalhe, Carrinho, Pagamento, Login, Cadastro, Comprovante, Perfil e Carteiras, desktop e mobile. Baselines versionadas, geradas e comparadas só no Docker (imagem oficial do Playwright), com dados fixos e máscara no que muda a cada execução (hash, data, anúncios de tempo real).
- **Acessibilidade:** axe (WCAG 2.1 A/AA) em 23 estados por viewport (carregando, erro, vazio, preenchido, diálogos abertos); compra completa só pelo teclado; foco preso e devolvido nos diálogos; `prefers-reduced-motion`; nenhuma tela com rolagem horizontal em 320, 390, 768 e 1440.
- **Relatórios:** relatório HTML e, nas falhas, trace e captura (`trace: 'retain-on-failure'`).

## Animações

As animações existem para o site não parecer estático, sem chamar atenção. O conteúdo que chega depois do skeleton entra com um fade e uma subida de 12px, e nas listas (catálogo, carrossel, carrinho, itens do pagamento) os itens entram um depois do outro, com 50 ms de diferença. As seções abaixo da dobra, como promoções, blog, carrosséis, abas do detalhe e o rodapé, começam invisíveis e entram quando aparecem na tela; o que já está visível quando a página carrega não anima. Tem ainda a elevação com brilho e zoom da imagem no hover dos cards, o "pulo" do coração com um anel ao favoritar, o pulinho do contador do carrinho quando um item entra, o sublinhado que desliza entre as abas do catálogo, uma reação leve dos botões ao clique e um fade curto na troca de página.

Tudo anima só `transform` e `opacity`, que não mudam o layout, por isso o CLS continua em 0. As imagens principais (o hero do Início e a imagem do Detalhe) nunca animam a entrada, porque são o LCP e precisam aparecer na hora; pelo mesmo motivo o fade de troca de página só roda a partir da primeira navegação dentro do app. Com `prefers-reduced-motion` ligado nada se mexe, e os testes visuais rodam nesse modo para as capturas ficarem estáveis.

## Performance

- **Primeira pintura sem esperar a camada de mocks:** o worker do MSW e a restauração da sessão não bloqueiam a renderização; o `socket.io-client` é importado depois que os mocks estão prontos.
- **Code splitting:** a rota `/` fica no bundle principal; as outras rotas, filtros, ordenação, Sheet, menu da conta e painel de simulação carregam sob demanda, com placeholders do mesmo tamanho.
- **Imagens e fontes:** artes em WebP de 400 e 800 px com `srcset`, preload da imagem de LCP e das fontes self-hosted, `loading="lazy"` abaixo da dobra; só o layout atual é renderizado (desktop ou mobile), para não baixar imagens do outro.
- **Sem deslocamento de layout:** skeletons com as medidas do conteúdo final (catálogo, detalhe, carrinho, pagamento, recibo); CLS 0 nas medições.

### Detalhe do NFT no mobile

A imagem principal (elemento de LCP) só pode ser pedida depois que a URL dela chega da API simulada. Antes disso o navegador precisa do JS do app, do worker do MSW (~182 KB gzip, que é a camada de mocks fazendo o papel do backend) e da resposta do NFT. No 4G simulado do Lighthouse, a fase "atraso de carregamento" do LCP fica em ~2,2 s em produção. Com um backend real esse caminho não teria o download do worker.

O que foi tentado:

- **Busca do NFT no loader da rota** (`prefetchQuery`, sem esperar a resposta): mantido. O LCP quase não muda, mas o TBT caiu de ~270 ms para ~30 ms, porque o trabalho deixa de se concentrar no primeiro render do componente.
- **`srcset`/`sizes` na imagem principal**: mantido. No mobile emulado (DPR 1,75) a imagem de ~360 px precisa de ~630 px, então o navegador ainda escolhe a versão de 800 px; a de 400 px é usada em telas de densidade menor.
- **Iniciar o MSW junto com o app nas rotas que dependem de dados** (em vez de depois da primeira pintura): revertido. O LCP não melhorou (4,64 s contra 4,68 s local) e o FCP piorou (3,2 s contra 2,5 s), porque o worker passa a disputar a rede com o JS da primeira tela.

O worker do MSW não foi alterado (nem as dependências que ele carrega, como `tldts` e `tough-cookie`). Os números atuais estão no README e em `lighthouse/resultados.md`.

## Limitações conhecidas

### Erro do service worker do MSW ao navegar entre páginas

Às vezes, ao trocar de página com recarga completa (link externo, `F5` ou digitar a URL), o console mostra:

```
Failed to update a ServiceWorker for scope ('<origem>/') with script ('<origem>/mockServiceWorker.js'): Not found
```

**Causa:** é uma corrida dentro do próprio MSW (2.15), não do app.

1. Quando a página antiga fecha, o worker recebe `CLIENT_CLOSED` e, se não sobrou nenhuma aba, se desregistra (`self.registration.unregister()` em `public/mockServiceWorker.js`).
2. A página nova sobe o MSW, que encontra esse registro ainda em remoção e chama `registration.update()` sem tratar o erro (`getWorkerInstance` em `msw/lib/browser`). A promessa rejeita com `Not found`.

**Impacto:** nenhum no funcionamento. Os mocks continuam respondendo, e as requisições e eventos seguintes funcionam normalmente.

**Por que não foi escondido:** o erro vem da camada de simulação, que só existe porque não há backend real. Escondê-lo com um `unhandledrejection` genérico poderia mascarar erros de verdade.

**Lighthouse:** não afeta as auditorias. O Lighthouse abre cada página uma vez, num perfil novo, sem página anterior fechando, então a corrida não acontece; a auditoria `errors-in-console` fica limpa e Best Practices em 100.

### Outras

- **Banco no `localStorage`:** cada aba tem sua cópia em memória e recarrega do storage no refresh; duas abas abertas ao mesmo tempo podem divergir até o refresh.
- **API de controle no deploy:** `/api/mock-control/*` existe também no build publicado, porque o deploy é a demonstração.
- **Hash de transação fictício:** o recibo marca `simulated: true` e mostra o aviso "Transação simulada" no lugar do link do Etherscan.
- **Itens fora do escopo:** aparecem desabilitados com "em breve" (lista nos desvios abaixo).

## Desvios do Figma

As telas seguem o Figma; quando o enunciado, a acessibilidade ou os dados reais pediram outra coisa, o desvio está aqui. Login, Cadastro, Perfil e Carteiras foram feitos a partir de exportações em PNG (a API do Figma estava no limite do plano), medidos nos pixels e comparados lado a lado em 1440, 768 e 390; as outras telas foram medidas pela árvore do arquivo.

### Gerais

- **Itens fora do escopo:** Mercado, Criadores, Aprenda, links e newsletter do rodapé, redes sociais, blog ("Ler mais"), leitor de NFT da tab bar, login social, "Esqueceu a senha?", código de indicação e os itens Atividade, Lista de interesse, Ofertas, Arquivos baixados e Suporte do menu da conta aparecem desabilitados, com "em breve" para leitor de tela e opacidade reduzida. O e-mail e o telefone do rodapé são links `mailto:` e `tel:` de verdade.
- **Textos em inglês do Figma:** traduzidos.
- **Cor de erro:** `#f2685c` não existe na paleta do Figma; foi escolhida pelo contraste sobre o fundo escuro (6,33:1).
- **Borda dos campos de texto:** o `#3f2319` do Figma tem 1,34:1 sobre o fundo, abaixo dos 3:1 que a WCAG 1.4.11 pede para o contorno de componentes. Os campos usam `#97543c` (token `--color-field-border`), o tom mais próximo (mesmo matiz e saturação, mais claro) que atinge 3:1 sobre o fundo (3,34:1) e sobre os cards (3,04:1). As outras bordas decorativas seguem o Figma.
- **Larguras fixas:** só valem a partir de 1280px; abaixo disso, grades fluidas, sem rolagem horizontal. Abas não quebram linha; em telas estreitas rolam na horizontal.
- **Topo das páginas internas:** nos frames de Carrinho, Pagamento, Perfil e Carteiras a linha do header vai mais abaixo que no Início; como o header é o mesmo em todas as telas, essas páginas compensam com 41px de distância (em vez de 32px).
- **Ícones provisórios:** a lixeira do carrinho, a carteira do Coinbase e os ícones do menu da conta são do lucide, parecidos com os do Figma (os originais não puderam ser exportados); o ícone "thank-you" do comprovante foi redesenhado em SVG; os ícones do Google e do Facebook são os oficiais das marcas.
- **Status do tempo real:** existe um rótulo de conexão só para leitor de tela e testes.

### Início

- **Contagens dos filtros:** no Figma, coleções e redes somam valores incoerentes entre si; a API mostra as contagens reais das 45 fixtures. A paginação mostra 5 páginas (o Figma mostra 4).
- **Checkbox nos filtros:** o Figma indica a seleção só pela cor; o app mostra um checkbox.
- **Favoritar e rede no card:** o card desktop do Figma não tem coração nem rede; o app mostra os dois, porque o enunciado pede.
- **Selo "RARO":** vem do campo `rarity` do NFT e aparece só no card mobile, como no Figma.
- **Mobile:** promoções e blog ficam ocultos (o frame mobile não os mostra); não há header (a navegação é pela tab bar); a ordenação fica dentro do Sheet de filtros.
- **Banner de destaque e promoções:** levam para filtros reais (em alta, novidades, uma coleção).
- **Hero:** o retângulo de fundo do Figma exportou vazio; o fundo usado é o da página.
- **Destaques:** o card 8 do Figma não tem nome; no app ele é o Golden Echo #071. "Nome (A-Z)" foi adicionado como opção de ordenação.

### Detalhe do NFT

- **Galeria:** cada NFT tem uma arte só; as 4 miniaturas (idênticas no Figma) mostram recortes dela. A lupa abre a arte ampliada num diálogo.
- **Pontos da galeria e do carrossel:** têm 24px de área de toque (o ponto do Figma fica dentro); no mobile são 4, um por recorte.
- **Rótulos trocados no Figma:** "Contrato:" mostrava o texto dos direitos autorais e vice-versa; no app cada rótulo tem o conteúdo certo.
- **Trilha:** "Início / <coleção>" (o Figma mostra "Início / Mercado", que está fora do escopo).
- **Dados:** coleção, atributos, raridade e descrições vêm da API, não dos textos fixos do Figma. Abaixo das edições aparece o estoque da edição escolhida.
- **Mobile:** a tab bar some e a barra de compra ocupa o lugar; abas de conteúdo e "Mais desta coleção" aparecem abaixo do painel.
- **Carrossel:** o 1º card do Figma tem uma imagem de tamanho diferente dos outros; o app segue os outros. 5 cards por página no desktop, 3 no tablet e 2 no mobile.
- **Compartilhar:** LinkedIn e X abrem os links reais de compartilhamento; e-mail usa `mailto:`.

### Carrinho

- **Textos:** trilha "Início / Carrinho"; "Resumo do pedido" no lugar de "Resumo da carteira"; coluna "Quantidade" no lugar de "Edições"; desconto com o cupom aplicado; valores no formato da API; "Taxa estimada (Ethereum)", porque o resumo usa a rede Ethereum e a rede da carteira é escolhida no pagamento.
- **Linha:** "Edição 1/50 · #0042" no lugar de "ID do token".
- **Mobile:** a lixeira fica em cada card (no Figma aparece só no 3º); a tab bar some; o resumo fica no fim da lista, sem cobrir os itens.
- **Avisos por linha:** preço alterado, estoque menor e esgotado não existem no Figma; seguem o padrão visual.
- **Subtotal:** o frame mobile soma errado; o app mostra o da API.
- **Tabela:** o espaço entre o cabeçalho e o primeiro item é feito com borda transparente nas células (com `border-spacing` o Chrome somava o dobro).

### Login e Cadastro

- **Modal ou página:** modal a partir de 768px, com o Início atrás (sem escurecer, como no PNG); página inteira abaixo disso, sem tab bar. O topo do modal se ajusta à altura da janela para não sair da tela.
- **Campos:** sem rótulo visível (como no PNG), com rótulo para leitor de tela; o erro aparece embaixo do campo e fica ligado a ele. Placeholders que pareciam valores viraram "Digite seu e-mail" e "Senha". As senhas têm mostrar/ocultar.
- **Cadastro:** não há campo de nome de exibição no PNG; ele começa igual ao nome de usuário e pode ser trocado no perfil. O botão é "Criar conta" no desktop e "Criar perfil" no mobile.

### Pagamento

- **Dados do colecionador:** o Figma repete dados da carteira e tem campos sem contrato; o app mostra os campos do pedido (nome de exibição, nome de usuário, e-mail, observação). Os dados da carteira aparecem nos cards Principal e Reserva, que no desktop ficam no lugar dos campos de carteira ("Usar outra carteira?" virou a escolha entre os cards).
- **Conexão:** o status é real ("Carteira conectada" ou "desconectada") com "Conectar"/"Desconectar"; trocar de carteira é escolher outro card.
- **Opções de conexão:** três opções com nome (WalletConnect, MetaMask, Coinbase Wallet); começa no app em que a carteira foi cadastrada, e outro app é recusado.
- **Itens e resumo:** "Edição" no lugar de "ID do token"; "Taxa estimada" com a rede da carteira; o cupom é aplicado no carrinho ("Aplique aqui" leva para lá).
- **Mobile:** além do que o frame mostra (carteiras, opções e total), o app traz os itens, o resumo, os dados do colecionador e a observação, pedidos no enunciado.
- **Estados que o Figma não tem:** cotação que mudou (com a lista do que mudou), pendente, recusado e sem resposta do servidor.
- **Asterisco dos obrigatórios:** a cor `#f0805f` do Figma virou o token `--color-required`.

### Comprovante

- **Modal sobre a página do pedido:** no Figma o fundo atrás do modal é 100% opaco e cobre o checkout inteiro. O app usa o mesmo fundo, mas o modal fica sobre a página `/pedidos/$orderId` (que funciona com acesso direto e refresh), não sobre o checkout montado: renderizar o checkout por baixo não apareceria e ainda leria a tentativa guardada no `sessionStorage`, podendo reenviar o pedido. Fechado (X ou Esc), mostra o resumo do pedido com "Ver comprovante" (o foco volta para ele) e "Voltar ao catálogo".
- **Conteúdo:** além de taxa e total, mostra subtotal e desconto; a taxa diz a rede; "Quantidade" e "Edição" como no carrinho; data no formato do Figma com meses em português.
- **Etherscan:** o botão "Ver no Etherscan" virou o aviso "Transação simulada" com o hash completo, e o botão principal é "Voltar ao catálogo".
- **Estados:** o Figma só tem o confirmado; pendente e recusado seguem o mesmo layout. Pedido de outra conta e inexistente viram uma página simples.
- **Mobile:** sem frame no Figma; página inteira no padrão do Carrinho e do Pagamento, com metadados em 2×2 e itens em lista.

### Perfil e Carteiras

- **Menu da conta:** a sidebar segue o PNG; abaixo de 1024px vira uma faixa de abas com rolagem horizontal, e no celular o "Sair" fica no topo, ao lado do título.
- **Perfil:** a lista de favoritos e pedidos da versão provisória saiu (Lista de interesse e Atividade estão "em breve"). O nome ENS é opcional e tem o ".eth" fixo ao lado (único domínio aceito). O Figma tem um "Salvar" só; o app tem "Salvar perfil" e "Salvar senha", porque são duas operações independentes.
- **Avatar:** "Alterar" abre o seletor; a imagem escolhida aparece como pré-visualização, com "Enviar" e "Cancelar". Tipo e tamanho são conferidos antes do envio; "Remover" só aparece quando há avatar.
- **Formulário de carteiras:** o Figma repete campos do perfil; o app mostra só os campos de carteira (apelido, rede, endereço, tipo e nome ENS opcional). "Igual à carteira principal" copia os dados da principal para o formulário da secundária.
- **Carteiras salvas:** o PNG mostra o formulário de uma conta sem carteira; com carteira salva, o app mostra um card (dados, status de conexão, conectar e desconectar e, na secundária, remover com confirmação), com "Editar" e "Adicionar" no lugar do "Adicionar" do PNG.
