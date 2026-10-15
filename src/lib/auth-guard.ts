import { redirect } from '@tanstack/react-router'
import { isLoggedIn, waitForSessionRestore } from '@/session/session-store'

// Usado no beforeLoad das rotas privadas: manda para o login lembrando onde estava.
export async function requireLogin({ location }: { location: { href: string } }) {
  await waitForSessionRestore()
  if (!isLoggedIn()) {
    throw redirect({ to: '/login', search: { redirect: location.href } })
  }
}

// Só aceita caminhos internos, para o ?redirect= não virar um redirecionamento aberto.
export function safeRedirectPath(path: string | undefined) {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return '/'
  return path
}
