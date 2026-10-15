# Arquitetura

Decisões, limitações e desvios do Figma. Este documento cresce junto com as telas.

## Limitações conhecidas

### Erro do service worker do MSW ao navegar entre páginas

Às vezes, ao trocar de página com recarga completa (link externo, `F5` ou digitar a URL), o console mostra:

```
Failed to update a ServiceWorker for scope ('<origem>/') with script ('<origem>/mockServiceWorker.js'): Not found
```

**Causa:** é uma corrida dentro do próprio MSW (2.15), não do app.

1. Quando a página antiga fecha, o worker recebe `CLIENT_CLOSED` e, se não sobrou nenhuma aba, se desregistra (`self.registration.unregister()` em `public/mockServiceWorker.js`).
2. A página nova sobe o MSW, que encontra esse registro ainda em remoção e chama `registration.update()` sem tratar o erro (`getWorkerInstance` em `msw/lib/browser`). A promessa rejeita com `Not found`.

**Impacto:** nenhum no funcionamento. Os mocks continuam respondendo, e as requisições e eventos seguintes funcionam normalmente. O erro também aparecia antes da mudança que adiou o início do MSW (conferido no build anterior).

**Por que não foi escondido:** o erro vem da camada de simulação, que só existe porque não há backend real. Escondê-lo com um `unhandledrejection` genérico poderia mascarar erros de verdade.

**Lighthouse:** não afeta as auditorias. O Lighthouse abre cada página uma vez, num perfil novo, sem página anterior fechando, então a corrida não acontece. Nas medições do Início (local e produção, mobile e desktop, 3 execuções cada) a auditoria `errors-in-console` não registrou nenhum erro e Boas Práticas ficou em 100.

## Performance

### Detalhe do NFT no mobile

A imagem principal (elemento de LCP) só pode ser pedida depois que a URL dela chega da API simulada. Antes disso o navegador precisa do JS do app, do worker do MSW (~182 KB gzip, que é a camada de mocks fazendo o papel do backend) e da resposta do NFT. No 4G simulado do Lighthouse, a fase "atraso de carregamento" do LCP fica em ~2,2 s em produção. Com um backend real esse caminho não teria o download do worker.

Medições (Lighthouse 12.6.1, Chrome 154, mediana de 3, `/nft/emerald-ape-042`):

| Versão                                        |                Mobile | Desktop |
| --------------------------------------------- | --------------------: | ------: |
| Primeira versão da tela, produção             |                    82 |     100 |
| Busca no loader da rota + `srcset`, produção  | **91** (87 / 91 / 91) | **100** |
| Mesma versão, `vite preview` local (HTTP/1.1) |                    80 |      98 |

O que foi tentado:

- **Busca do NFT no loader da rota** (`prefetchQuery`, sem esperar a resposta): mantido. O LCP quase não muda, mas o TBT caiu de ~270 ms para ~30 ms, porque o trabalho deixa de se concentrar no primeiro render do componente.
- **`srcset`/`sizes` na imagem principal**: mantido. No mobile emulado (DPR 1,75) a imagem de ~360 px precisa de ~630 px, então o navegador ainda escolhe a versão de 800 px; a de 400 px é usada em telas de densidade menor.
- **Iniciar o MSW junto com o app nas rotas que dependem de dados** (em vez de depois da primeira pintura): revertido. O LCP não melhorou (4,64 s contra 4,68 s local) e o FCP piorou (3,2 s contra 2,5 s), porque o worker passa a disputar a rede com o JS da primeira tela.

O worker do MSW não foi alterado (nem as dependências que ele carrega, como `tldts` e `tough-cookie`).
