# Arquitetura

Aqui explico como o app está organizado, como a API simulada funciona, as decisões de estado e tempo real, como testei, o que ainda tem limitação e onde a implementação ficou diferente do Figma. Para rodar o projeto, veja o [README](./README.md).

## Estrutura de pastas

```
src/
  main.tsx, app.tsx     entrada: QueryClient, router e início do MSW
  routes/               rotas do TanStack Router, uma por arquivo (routeTree.gen.ts é gerado)
  pages/                as telas: Início, Detalhe, Carrinho, Pagamento, Pedido, Perfil, Carteiras
  components/
    ui/                 componentes do shadcn/ui ajustados aos tokens do projeto
    layout/             header, rodapé, tab bar do celular, menu da conta
    catalog/, home/     cards, filtros, abas, paginação e o resto do Início
    nft/                galeria, edições, quantidade, carrossel, abas do detalhe
    cart/, checkout/    resumo do carrinho e as partes do pagamento
    order/              recibo do pedido
    auth/, account/     login e cadastro; menu da conta, avatar e formulário de carteira
    form/               campos com rótulo, erro, select, senha e ENS
  api/
    contracts/          schemas zod de requisições, respostas, erros e eventos
    http.ts, errors.ts  cliente Axios e o erro padrão do app (ApiRequestError)
    *.ts                hooks do TanStack Query de cada recurso
    query-keys.ts       todas as query keys
  session/              token, usuário e restauração da sessão
  realtime/             conexão Socket.IO e aplicação dos eventos no cache
  lib/                  utilidades (guarda de rota, tentativa de compra, cotações...)
  mocks/                a API simulada: banco, fixtures, handlers, socket e cenários
e2e/
  app/                  testes de interface e baselines visuais
  api/                  testes dos contratos da API simulada
  support/              helpers dos testes
scripts/                Playwright no Docker e Lighthouse
```

## API REST

Tudo fica embaixo de `/api` e fala JSON. O login devolve um token que vai no `Authorization: Bearer`. O visitante tem um id de carrinho que vai no header `X-Cart-Id`. Os mesmos schemas zod de `src/api/contracts/` validam os formulários e os corpos que chegam nos handlers, então front e "back" concordam no formato. Valores em ETH sempre trafegam como texto decimal (`"1.19"`) e são calculados com `decimal.js`, para não ter erro de ponto flutuante.

Os erros seguem um formato só:

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

| Status  | Códigos                                                                                                                             |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 400     | `BAD_REQUEST`                                                                                                                       |
| 401     | `UNAUTHENTICATED`, `SESSION_EXPIRED`, `INVALID_CREDENTIALS`                                                                         |
| 403     | `FORBIDDEN`                                                                                                                         |
| 404     | `NOT_FOUND`                                                                                                                         |
| 409     | `EMAIL_TAKEN`, `USERNAME_TAKEN`, `OUT_OF_STOCK`, `QUOTE_OUTDATED`, `IDEMPOTENCY_CONFLICT`, `WALLET_REJECTED`, `WALLET_DISCONNECTED` |
| 422     | `VALIDATION_ERROR`, `COUPON_INVALID`, `COUPON_EXPIRED`, `WRONG_PASSWORD`                                                            |
| 500/503 | `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`                                                                                             |

No cliente todo erro vira `ApiRequestError`. Falha de rede e timeout (10 s) chegam com status 0. Quando o servidor manda `fields`, a mensagem aparece embaixo do campo certo do formulário.

Os endpoints:

- Sessão: `POST /auth/register`, `POST /auth/login`, `GET /auth/session` e `POST /auth/logout`. O token vale 30 minutos. Login e cadastro aceitam o id do carrinho de visitante para juntar os itens na conta.
- Catálogo: `GET /nfts` com busca, coleção, rede, faixa de preço, aba (todos, novidades, em alta), ordenação e página. A resposta traz as contagens dos filtros calculadas sobre o catálogo inteiro. `GET /nfts/:id` traz o detalhe com descrição, atributos, avaliações, raridade e as edições, cada uma com seu estoque e máximo por pedido.
- Favoritos: `GET /favorites`, `PUT /favorites/:id` e `DELETE /favorites/:id`.
- Carrinho: listar, adicionar, mudar quantidade, remover e aplicar ou tirar cupom. Toda resposta devolve o carrinho inteiro, incluindo o preço de quando o item entrou, para a tela avisar se mudou.
- Cotação: `POST /quote {network}` calcula linhas, desconto, taxa da rede e total, e marca problemas por linha (preço mudou, esgotou, estoque menor que a quantidade). Vale 10 minutos.
- Pedidos: `POST /orders` com `Idempotency-Key`, `GET /orders` e `GET /orders/:id` (403 se o pedido for de outra pessoa). O pedido nasce pendente e se resolve em 2 segundos. O recibo é uma cópia da cotação no momento da compra e nunca muda depois.
- Perfil: ler e editar dados, enviar ou remover avatar (PNG, JPEG ou WebP até 1 MB) e trocar a senha.
- Carteiras: principal e secundária. O endereço é validado conforme a rede (`0x` com 40 hexadecimais em Ethereum e Polygon, base58 em Solana). Conectar recusa se o app escolhido não for o da carteira.

## Eventos Socket.IO

O cliente conecta em `<origem>/socket.io`, só por websocket, mandando o token na query. Todo evento tem `eventId`, `type`, o recurso afetado, a `version` desse recurso, a data e os dados.

`nft.updated` vai para todo mundo, com o preço e o estoque de cada edição. O app atualiza o detalhe e o catálogo e, se o NFT estiver no carrinho, busca de novo o carrinho e a cotação e anuncia a mudança para o leitor de tela.

`order.updated` vai só para as conexões do dono do pedido, com o status e o motivo da recusa, se houver. O app atualiza o pedido na tela e anuncia a confirmação ou a recusa.

## Sessão e carrinho

O token fica no `localStorage` e o usuário num store pequeno da sessão. Ao abrir o app com um token salvo, ele confere a sessão com `GET /auth/session`. Enquanto isso, as requisições esperam, as rotas protegidas aguardam e o cache fica numa chave provisória, para nada privado ir parar no cache de visitante. Se a sessão vence no meio do uso, o app manda para o login com "Sua sessão expirou" e, depois de entrar, volta para onde a pessoa estava.

Quem não está logado também tem carrinho. Ao entrar ou se cadastrar, o servidor soma esse carrinho ao da conta (respeitando o estoque) e apaga o de visitante. Dá para escolher os NFTs deslogado, entrar e pagar sem perder nada.

## Cache e query keys

Os dados passam todos pelo TanStack Query. O que é público fica em `['nfts', ...]`. O que é de alguém fica embaixo do dono: `['owner', 'user:<id>', ...]` ou `['owner', 'guest:<carrinho>', ...]`. Trocar de usuário troca o prefixo, então os dados de uma conta nunca aparecem para outra. As chaves estão todas em `src/api/query-keys.ts`.

Leituras tentam de novo até 2 vezes quando o erro é de rede ou 5xx. Escritas não repetem sozinhas, com uma exceção: criar o pedido, que é seguro porque tem idempotência.

O favorito é otimista: o coração muda na hora e, se a requisição falhar, volta ao estado anterior. O resto (carrinho, perfil, carteiras) espera a resposta do servidor e trava os botões enquanto envia.

## Tempo real e REST juntos

O app guarda os `eventId` que já aplicou e ignora os repetidos. Cada recurso tem uma versão, e um evento com versão menor ou igual à que está no cache é descartado; por isso um pedido confirmado nunca volta a "pendente" por causa de um evento atrasado.

Quando o socket reconecta, o app busca de novo pelo REST tudo o que está na tela, porque pode ter perdido eventos enquanto estava fora. Pedidos pendentes também são consultados a cada 3 segundos, para o caso de o evento se perder. Ao trocar de usuário a conexão é refeita com o novo token, e o logout fecha no servidor os sockets do token antigo, então eventos de uma sessão não chegam na outra. Os listeners saem quando o componente que conecta desmonta.

## Checkout e idempotência

A página de pagamento já funciona como revisão: a cotação que aparece é a que a pessoa está aceitando. Se ela muda antes da confirmação (evento do socket ou resposta do servidor), a tela lista o que mudou, como preço, estoque, desconto e total, e pede uma nova revisão. Se algum item esgotou, o caminho é ajustar no carrinho. Uma cotação desatualizada nunca é confirmada.

Ao confirmar, o app valida o formulário, confere se a carteira está conectada, busca a cotação de novo e só envia se ela continuar igual. Cada tentativa ganha uma `Idempotency-Key` nova, guardada junto com o pedido no `sessionStorage`. Os retries automáticos e o botão "Tentar de novo" usam a mesma chave. No servidor, a mesma chave com o mesmo corpo devolve o pedido que já existe; com outro corpo, dá 409.

Se a página recarrega no meio do envio, ela reenvia a tentativa guardada e recebe o pedido já criado, sem comprar duas vezes. Com o pedido criado, a tela mostra "Pagamento pendente" até a resposta chegar: confirmado abre o comprovante, recusado mostra o motivo e o caminho de volta.

## Camada de mocks

O MSW intercepta `/api/*` e o Socket.IO no navegador, em desenvolvimento, nos testes e no deploy. Nenhum componente, hook ou cliente Axios tem resposta fictícia; tudo passa pela rede simulada.

Os dados começam das fixtures (45 NFTs, dois usuários, cupons e um pedido antigo) e ficam num banco em memória, salvo no `localStorage` para aguentar o refresh. As senhas ficam como hash. Os handlers aplicam as regras que um backend aplicaria: validação, estoque, máximo por pedido, validade da cotação, idempotência, isolamento entre usuários e resolução do pedido pelo tempo.

Os cenários (lentidão, falhas, timeout, sessão vencida, falhas de pagamento e de carteira) ficam salvos no navegador, e a latência variável usa uma semente fixa, então dá para reproduzir. A API de controle troca o cenário, injeta falha numa rota, reseta, mexe em preço e estoque, libera pedidos, reenvia eventos e derruba o socket. Quem usa é o painel de simulação e os testes; as telas não dependem dela.

O worker do MSW só começa a carregar depois que a primeira tela aparece, para não disputar a rede com ela. A exceção é quando há um token salvo, porque aí a sessão depende da API logo no início.

O binding de Socket.IO do MSW tem algumas limitações. Só funciona por websocket, sem long-polling, rooms ou namespaces, e o servidor simulado não manda ping. O token vai na query porque o `auth` do handshake não chega no mock. O `socket.io-client` só pode ser carregado depois que o worker sobe, porque guarda a referência do `WebSocket` quando o módulo carrega. E essas conexões não aparecem como WebSocket no DevTools.

## Testes

Os testes E2E rodam no Chromium em desktop (1440×900) e celular (Pixel 7, 390×844), e todos os testes de tela rodam nos dois. Cada teste começa com os mocks resetados, num navegador limpo, e confere o que aparece na tela e o resultado das operações. As chamadas REST passam pelos handlers do MSW e os eventos passam pelo `socket.io-client`, sem mexer no cache por fora.

Cobrem os 12 cenários do enunciado: busca e histórico, detalhe direto e inexistente, sessão, favoritos com falha, carrinho, compra completa, falhas de pagamento, perfil e carteiras, mudança de preço pelo socket no checkout, eventos repetidos ou antigos com pedido pendente e socket fora, teclado e foco, e skeletons com recuperação.

Para os testes de tempo uso o `page.clock`: o relógio continua andando e o `setSystemTime` adianta 30 minutos de sessão ou 10 de cotação sem disparar os timers da página (o `fastForward` dispararia o timeout do Axios no meio das requisições). Latência e falhas vêm dos cenários, e os eventos são disparados pela API de controle.

A regressão visual cobre Início, Detalhe, Carrinho, Pagamento, Login, Cadastro, Comprovante, Perfil e Carteiras, no desktop e no celular. As baselines ficam no repositório e são geradas e comparadas sempre dentro do Docker, com dados fixos e com máscara no que muda a cada execução, como o hash e a data do pedido.

Em acessibilidade, o axe roda em 23 estados por tamanho de tela (carregando, erro, vazio, preenchido e com diálogos abertos), uma compra inteira é feita só pelo teclado, o foco dos diálogos é conferido, o `prefers-reduced-motion` é testado e nenhuma tela tem rolagem horizontal em 320, 390, 768 e 1440 px. Nas falhas, o Playwright guarda trace e captura, e o relatório HTML fica disponível.

## Animações

As animações existem para o site não parecer estático, sem chamar atenção. O conteúdo que chega depois do skeleton entra com um fade e uma subida de 12px, e nas listas (catálogo, carrossel, carrinho, itens do pagamento) os itens entram um depois do outro, com 50 ms de diferença. As seções abaixo da dobra, como promoções, blog, carrosséis, abas do detalhe e o rodapé, começam invisíveis e entram quando aparecem na tela; o que já está visível quando a página carrega não anima. Tem ainda a elevação com brilho e zoom da imagem no hover dos cards, o "pulo" do coração com um anel ao favoritar, o pulinho do contador do carrinho quando um item entra, o sublinhado que desliza entre as abas do catálogo, uma reação leve dos botões ao clique e um fade curto na troca de página.

Tudo anima só `transform` e `opacity`, que não mudam o layout, por isso o CLS continua em 0. As imagens principais (o hero do Início e a imagem do Detalhe) nunca animam a entrada, porque são o LCP e precisam aparecer na hora; pelo mesmo motivo o fade de troca de página só roda a partir da primeira navegação dentro do app. Com `prefers-reduced-motion` ligado nada se mexe, e os testes visuais rodam nesse modo para as capturas ficarem estáveis.

## Performance

A primeira tela não espera o MSW nem a sessão. As rotas além do Início, os filtros, a ordenação, o menu da conta e o painel de simulação são carregados só quando usados, com placeholders do mesmo tamanho para nada pular. As artes vêm em WebP de 400 e 800 px com `srcset`, a imagem principal e as fontes são pré-carregadas, e o que está abaixo da dobra é lazy. Os skeletons têm as medidas do conteúdo final, por isso o CLS fica em 0.

O Detalhe no celular é a página mais lenta, e o motivo é a camada de mocks. A imagem principal só pode ser pedida depois que a URL dela chega da API simulada, e antes disso o navegador precisa do JS do app, do worker do MSW (uns 182 KB comprimidos) e da resposta do NFT. Com um backend de verdade esse caminho não teria o worker. Para melhorar, passei a buscar o NFT no loader da rota (o TBT caiu de uns 270 ms para 30 ms) e coloquei `srcset` na imagem. Também tentei subir o MSW junto com o app nessas rotas, mas o LCP não melhorou e a primeira pintura piorou, então voltei atrás.

## Limitações conhecidas

Às vezes, ao recarregar a página ou entrar por um link externo, o console mostra `Failed to update a ServiceWorker ... Not found`. É uma corrida dentro do próprio MSW: quando a última aba fecha, o worker se desregistra, e a página nova encontra esse registro ainda sendo removido e chama `registration.update()` sem tratar o erro. Não afeta nada; os mocks continuam respondendo. Preferi não esconder o erro com um tratamento genérico, que poderia mascarar problemas de verdade. O Lighthouse não pega isso, porque abre cada página uma vez num perfil novo.

Outras limitações:

- O banco simulado fica no `localStorage` e cada aba tem a sua cópia em memória; duas abas abertas podem divergir até o refresh.
- A API de controle existe também no deploy, porque o deploy é a demonstração.
- O hash da transação é fictício. O recibo deixa isso claro com o aviso "Transação simulada" no lugar do link do Etherscan.
- Itens fora do escopo têm a aparência normal, com um cadeado pequeno e o tooltip "Em breve" no hover e no foco (no rodapé, só o tooltip); clicar não faz nada, e o leitor de tela ouve "(em breve)" com `aria-disabled`.

## Desvios do Figma

As telas seguem o Figma. Abaixo estão só os pontos em que a implementação ficou diferente, e por quê.

### Escopo do enunciado

1. Tudo que o enunciado não pede fica com o cadeado e o tooltip "Em breve": Criadores, Aprenda, newsletter e links do rodapé, blog, login social, "Esqueceu a senha?", código de indicação, o leitor de NFT da tab bar e os itens Atividade, Lista de interesse, Ofertas, Arquivos baixados e Suporte do menu da conta.
2. O card do catálogo no desktop mostra o coração de favoritar e a rede, que o Figma não tem, porque o enunciado pede.
3. Os formulários seguem os contratos da API. O pagamento pede só os dados do pedido (nome de exibição, usuário, e-mail e observação), e os dados da carteira aparecem nos cards Principal e Reserva. O formulário de carteiras tem só os campos de carteira. O perfil tem um botão para os dados e outro para a senha, porque são operações separadas.
4. O comprovante mostra subtotal e desconto além de taxa e total, e no lugar de "Ver no Etherscan" tem o aviso de transação simulada, porque o hash não existe em nenhum explorer.

### Acessibilidade

5. A seleção nos filtros usa checkbox, para não depender só da cor.
6. A borda dos campos de texto é um pouco mais clara que a do Figma (`#97543c` no lugar de `#3f2319`). A original tinha contraste de 1,34:1 com o fundo, e a WCAG pede pelo menos 3:1 para o contorno de componentes; usei o tom mais próximo que passa.
7. A cor de erro (`#f2685c`) não existe na paleta do Figma; escolhi pelo contraste com o fundo escuro.
8. Os pontos da galeria e do carrossel têm 24 px de área de toque, com o ponto do Figma dentro.

### Inconsistências do próprio Figma

9. As contagens dos filtros e o subtotal do carrinho no celular não fecham no Figma; o app mostra os valores reais da API. No detalhe, os rótulos "Contrato" e "Direitos autorais" estavam com os conteúdos trocados.
10. As quatro miniaturas da galeria são iguais no Figma. Como cada NFT tem uma arte só, elas mostram recortes dessa arte.
11. Os ícones da lucide entram no lugar dos desenhados no Figma, com as mesmas formas (lixeira do carrinho, carteira do pagamento e o menu da conta). O ícone de agradecimento do comprovante foi desenhado em SVG com a forma do Figma, e os de Google e Facebook são os oficiais das marcas.

### Estados que o Figma não tem

12. Carregamento, erro, vazio e os avisos que surgem com o tempo real seguem o mesmo visual das telas: skeletons, erro com "Tentar de novo", carrinho vazio, preço alterado ou item esgotado no carrinho, cotação que mudou, pagamento pendente, recusado ou sem resposta, comprovante pendente ou recusado e pedido de outra conta.

### Adaptações para o celular

13. Telas sem versão de celular no Figma (comprovante, perfil e carteiras) viraram páginas inteiras no mesmo padrão do carrinho e do pagamento. O menu da conta vira uma faixa de abas com rolagem horizontal, e login e cadastro, que são modais no desktop, viram páginas.
14. No celular, o detalhe e o carrinho trocam a tab bar pela barra de compra, a ordenação do catálogo fica dentro dos filtros, e o pagamento mostra também os itens, o resumo e os dados do comprador, que o Figma deixa de fora nessa tela. O rodapé, que não aparece nos frames de celular, fica no fim de todas as páginas, e os botões das telas sem versão de celular usam o formato de pílula das outras telas mobile do Figma.
