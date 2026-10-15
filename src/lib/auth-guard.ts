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

// Fechar o login ou o cadastro volta para o Início; o foco volta para o botão "Entrar"
// do header, que é quem abre o modal (o Dialog não tem um gatilho próprio).
export function focusHeaderLogin() {
  document.getElementById('header-login')?.focus()
}
