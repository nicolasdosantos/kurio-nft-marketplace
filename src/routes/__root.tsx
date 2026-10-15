import { lazy, Suspense } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { useAnnouncement } from '@/realtime/announcements'
import { useRealtimeSync } from '@/realtime/useRealtimeSync'

export interface RouterContext {
  queryClient: QueryClient
}

// Devtools só em dev, para não entrar no bundle de produção.
const Devtools = import.meta.env.DEV ? lazy(() => import('@/lib/devtools')) : () => null

const MockPanel =
  import.meta.env.VITE_ENABLE_MOCKS === 'true'
    ? lazy(() => import('@/components/MockPanel').then((module) => ({ default: module.MockPanel })))
    : () => null

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
})

function RootLayout() {
  useRealtimeSync()
  const announcement = useAnnouncement()

  return (
    <>
      <a
        href="#conteudo"
        className="sr-only z-50 rounded bg-primary px-3 py-2 font-bold text-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Pular para o conteúdo
      </a>
      <SiteHeader />
      <div id="conteudo" tabIndex={-1} className="outline-none">
        <Outlet />
      </div>
      <SiteFooter />
      <MobileTabBar />
      <p role="status" aria-live="polite" data-testid="realtime-announcement" className="sr-only">
        {announcement}
      </p>
      <Suspense>
        <Devtools />
        <MockPanel />
      </Suspense>
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
