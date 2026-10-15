import { lazy, Suspense } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Link, Outlet, useRouterState } from '@tanstack/react-router'
import { MockPanelToggle } from '@/components/MockPanelToggle'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { useAnnouncement } from '@/realtime/announcements'
import { useRealtimeSync } from '@/realtime/useRealtimeSync'
import { useSocketStatus } from '@/realtime/useSocketStatus'
import { useMediaQuery } from '@/lib/use-media-query'

export interface RouterContext {
  queryClient: QueryClient
}

// Devtools só em dev, para não entrar no bundle de produção.
const Devtools = import.meta.env.DEV ? lazy(() => import('@/lib/devtools')) : () => null

const showMockPanel = import.meta.env.VITE_ENABLE_MOCKS === 'true'

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
})

function RootLayout() {
  useRealtimeSync()
  const announcement = useAnnouncement()
  const socketConnected = useSocketStatus()
  // Header e tab bar não ficam escondidos por CSS: o que não aparece nem é renderizado,
  // para não baixar os ícones do outro layout.
  const isTabletUp = useMediaQuery('(min-width: 768px)')
  // Telas cujo Figma mobile não tem tab bar: no detalhe e no carrinho a barra de compra
  // e o resumo ficam no lugar dela; login e cadastro são páginas inteiras.
  const hideTabBar = useRouterState({
    select: (state) => {
      const { pathname } = state.location
      return pathname.startsWith('/nft/') || ['/carrinho', '/login', '/cadastro'].includes(pathname)
    },
  })

  return (
    <>
      <a
        href="#conteudo"
        className="sr-only z-50 rounded bg-primary px-3 py-2 font-bold text-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Pular para o conteúdo
      </a>
      {isTabletUp && <SiteHeader />}
      <div id="conteudo" tabIndex={-1} className="outline-none">
        <Outlet />
      </div>
      <SiteFooter />
      {!isTabletUp && !hideTabBar && <MobileTabBar />}
      <span className="sr-only">
        Tempo real:{' '}
        <span data-testid="socket-status">{socketConnected ? 'conectado' : 'desconectado'}</span>
      </span>
      <p role="status" aria-live="polite" data-testid="realtime-announcement" className="sr-only">
        {announcement}
      </p>
      <Suspense>
        <Devtools />
      </Suspense>
      {showMockPanel && <MockPanelToggle />}
    </>
  )
}

function NotFoundPage() {
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-heading font-bold text-text-accent">Página não encontrada</h1>
      <Link to="/" className="text-text-secondary underline underline-offset-4">
        Voltar para o início
      </Link>
    </main>
  )
}
