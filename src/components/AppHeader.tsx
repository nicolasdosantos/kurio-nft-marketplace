import { Link, useNavigate } from '@tanstack/react-router'
import { useLogout } from '@/api/auth'
import { useCart } from '@/api/cart'
import { useSocketStatus } from '@/realtime/useSocketStatus'
import { useSession } from '@/session/session-store'

export function AppHeader() {
  const session = useSession()
  const cartQuery = useCart()
  const logout = useLogout()
  const navigate = useNavigate()
  const socketConnected = useSocketStatus()

  const cartCount = cartQuery.data?.items.reduce((total, cartItem) => total + cartItem.quantity, 0)

  return (
    <header className="border-b border-border p-4">
      <nav aria-label="Principal" className="mx-auto flex max-w-5xl flex-wrap items-center gap-4">
        <Link to="/" className="font-bold">
          KURIO
        </Link>
        <Link to="/carrinho" data-testid="cart-link">
          Carrinho ({cartCount ?? 0})
        </Link>
        {session.user ? (
          <>
            <Link to="/perfil" data-testid="current-user">
              {session.user.displayName}
            </Link>
            <Link to="/carteiras">Carteiras</Link>
            <button
              type="button"
              onClick={() => logout.mutate(undefined, { onSettled: () => navigate({ to: '/' }) })}
              className="underline"
            >
              Sair
            </button>
          </>
        ) : (
          <Link to="/login" className="rounded bg-primary px-3 py-1 text-primary-foreground">
            Entrar
          </Link>
        )}
        <span className="ml-auto text-body-sm text-text-secondary">
          Tempo real:{' '}
          <span data-testid="socket-status">{socketConnected ? 'conectado' : 'desconectado'}</span>
        </span>
      </nav>
    </header>
  )
}
