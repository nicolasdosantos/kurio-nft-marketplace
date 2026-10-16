import { lazy, Suspense, useState, type FormEvent } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useCartCount } from '@/api/cart'
import { Input } from '@/components/ui/input'
import { useSession } from '@/session/session-store'
import { ComingSoon } from './ComingSoon'
import { useBumpKey } from '@/lib/use-bump-key'
import { cn } from '@/lib/utils'

// O menu da conta (DropdownMenu do Radix) só é baixado para quem está logado.
const UserMenu = lazy(() => import('./UserMenu').then((module) => ({ default: module.UserMenu })))

function HeaderSearch({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate()
  const currentQuery = useRouterState({
    select: (state) => (state.location.search as { q?: string }).q ?? '',
  })
  const [searchText, setSearchText] = useState(currentQuery)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const q = searchText.trim() || undefined
    // Busca nova sempre começa na página 1, mantendo os outros filtros se já estiver na home.
    navigate({ to: '/', search: (previous) => ({ ...previous, q, page: undefined }) })
    onDone()
  }

  return (
    <form role="search" onSubmit={handleSubmit} className="flex gap-2 pt-4">
      <label htmlFor="header-search" className="sr-only">
        Buscar NFTs
      </label>
      <Input
        id="header-search"
        type="search"
        autoFocus
        value={searchText}
        onChange={(event) => setSearchText(event.target.value)}
        placeholder="Buscar por nome ou coleção"
        className="h-10 bg-surface-card"
      />
      <button
        type="submit"
        className="h-10 rounded-[6px] bg-primary px-4 font-bold text-ink hover:bg-text-accent"
      >
        Buscar
      </button>
    </form>
  )
}

export function SiteHeader() {
  const session = useSession()
  const cartCount = useCartCount()
  const cartBump = useBumpKey(cartCount)
  const [searchOpen, setSearchOpen] = useState(false)
  const isHome = useRouterState({ select: (state) => state.location.pathname === '/' })

  return (
    <header className="mx-auto hidden w-full max-w-[1232px] px-4 pt-6 md:block">
      <div className="flex items-start justify-between">
        <Link
          to="/"
          className="pt-2 text-body-sm font-bold tracking-[1.4px] text-foreground lg:w-40"
        >
          KURIO
        </Link>

        <nav aria-label="Principal" className="flex gap-6 text-body-md lg:gap-10">
          <Link
            to="/"
            aria-current={isHome ? 'page' : undefined}
            className="flex w-[58px] flex-col gap-6 text-foreground aria-[current=page]:font-bold aria-[current=page]:text-text-accent"
          >
            Início
            {isHome && <img src="/icons/nav-underline.svg" alt="" className="h-[3px] w-full" />}
          </Link>
          <ComingSoon className="text-foreground">Mercado</ComingSoon>
          <ComingSoon className="text-foreground">Criadores</ComingSoon>
          <ComingSoon className="text-foreground">Aprenda</ComingSoon>
        </nav>

        <div className="flex items-center gap-5 lg:gap-7">
          <button
            type="button"
            aria-label="Abrir busca"
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen((open) => !open)}
            className="rounded-sm"
          >
            <img src="/icons/search.svg" alt="" width={20} height={20} />
          </button>

          <Link
            to="/carrinho"
            data-testid="cart-link"
            aria-label={`Carrinho, ${cartCount} ${cartCount === 1 ? 'item' : 'itens'}`}
            className="relative grid size-6 place-items-start rounded-sm"
          >
            <img src="/icons/cart.svg" alt="" width={24} height={24} />
            <span
              key={cartBump}
              className={cn(
                'absolute -top-1 left-[15px] grid size-4 place-items-center rounded-full bg-primary text-tiny font-medium text-ink outline-2 outline-ink',
                cartBump > 0 && 'animate-bump',
              )}
            >
              <span data-testid="cart-count">{cartCount}</span>
            </span>
          </Link>

          {session.restoring ? (
            // Ainda conferindo o token salvo: reserva o lugar sem mostrar "Entrar".
            <span aria-hidden="true" className="h-[35px] w-[100px]" />
          ) : session.user ? (
            <Suspense fallback={<span aria-hidden="true" className="h-[35px] w-[100px]" />}>
              <UserMenu />
            </Suspense>
          ) : (
            <Link
              id="header-login"
              to="/login"
              className="flex h-[35px] w-[100px] items-center justify-center gap-1 rounded-[6px] bg-primary text-body-md font-medium text-ink hover:bg-text-accent"
            >
              <img src="/icons/login.svg" alt="" width={18} height={17} />
              Entrar
            </Link>
          )}
        </div>
      </div>
      {searchOpen && <HeaderSearch onDone={() => setSearchOpen(false)} />}
      <img src="/icons/header-divider.svg" alt="" className="mt-0 h-px w-full" />
    </header>
  )
}
