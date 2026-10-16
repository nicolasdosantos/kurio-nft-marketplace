import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { restoreSession } from './api/auth'
import { onSessionExpired } from './api/http'
import { queryKeys } from './api/query-keys'
import { startMocks } from './lib/mocks-ready'
import { queryClient } from './lib/query-client'
import { getSession } from './session/session-store'
import { routeTree } from './routeTree.gen'

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Sessão expirou no meio do uso: some com os dados privados e vai para o login,
// guardando a página atual para voltar depois.
onSessionExpired(() => {
  queryClient.cancelQueries()
  queryClient.removeQueries({ queryKey: ['owner'] })
  const currentPath = router.state.location.href
  if (!currentPath.startsWith('/login')) {
    router.navigate({ to: '/login', search: { redirect: currentPath, expired: true } })
  }
})

export function renderApp(rootElement: HTMLElement) {
  // Com um token salvo, saber quem é o usuário depende da API (e as rotas privadas
  // esperam por isso antes de renderizar): o worker sobe na hora, sem esperar a tela.
  if (getSession().restoring) void startMocks()

  // Roda em segundo plano; quem depende da sessão espera por ela (Axios e rotas privadas).
  // O que foi buscado enquanto a sessão era conferida fica numa chave provisória.
  void restoreSession().then(() =>
    queryClient.removeQueries({ queryKey: queryKeys.owner('pending') }),
  )

  createRoot(rootElement).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )

  // O worker do MSW (o maior arquivo do app) só começa a baixar depois que a
  // primeira tela foi pintada. onRendered vem logo após o commit do React, antes
  // da pintura; os dois frames garantem que ela já aconteceu.
  const stopWaiting = router.subscribe('onRendered', () => {
    stopWaiting()
    requestAnimationFrame(() => requestAnimationFrame(() => void startMocks()))
  })

  // O fade de troca de página só vale a partir da primeira navegação dentro do app: na
  // carga inicial ele atrasaria o LCP (o Chrome só conta o elemento quando fica visível).
  const stopWatchingNavigation = router.subscribe('onBeforeNavigate', (event) => {
    if (!event.fromLocation || !event.pathChanged) return
    stopWatchingNavigation()
    document.documentElement.dataset.navigated = 'true'
  })
}
