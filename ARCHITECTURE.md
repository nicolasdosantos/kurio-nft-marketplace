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
