import { lazy, Suspense } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router'
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

  return (
    <>
      <Outlet />
      <Suspense>
        <Devtools />
        <MockPanel />
      </Suspense>
    </>
  )
}

function NotFoundPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-heading font-bold text-text-accent">Página não encontrada</h1>
      <Link to="/" className="text-text-secondary underline underline-offset-4">
        Voltar para o início
      </Link>
    </main>
  )
}
