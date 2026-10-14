import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { restoreSession } from './api/auth'
import { onSessionExpired } from './api/http'
import { queryClient } from './lib/query-client'
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

export async function renderApp(rootElement: HTMLElement) {
  await restoreSession()

  createRoot(rootElement).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
}
