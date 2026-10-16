import { Link, useRouterState } from '@tanstack/react-router'
import { useCartCount } from '@/api/cart'
import { useSession } from '@/session/session-store'
import { useBumpKey } from '@/lib/use-bump-key'
import { cn } from '@/lib/utils'

// Ícones laterais posicionados em % da largura, para a barra acompanhar telas menores;
// as peças do ícone central são relativas ao círculo.
const scanIconPieces = [
  { src: '/icons/tabbar-scan-5.svg', left: 20.3, top: 21, width: 10.4 },
  { src: '/icons/tabbar-scan-3.svg', left: 34.1, top: 21.1, width: 10.4 },
  { src: '/icons/tabbar-scan-1.svg', left: 19, top: 32.1, width: 26.8 },
  { src: '/icons/tabbar-scan-2.svg', left: 20.3, top: 34.7, width: 10.3 },
  { src: '/icons/tabbar-scan-4.svg', left: 34.1, top: 34.7, width: 10.3 },
]

const sideIconClasses = 'absolute top-[71px] grid size-5 place-items-center'

export function MobileTabBar() {
  const session = useSession()
  const cartCount = useCartCount()
  const cartBump = useBumpKey(cartCount)
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const accountPath = session.user ? '/perfil' : '/login'

  return (
    <nav
      aria-label="Navegação inferior"
      className="fixed inset-x-0 bottom-0 z-40 h-[126px] overflow-hidden md:hidden"
    >
      <img
        src="/icons/tabbar-background.svg"
        alt=""
        className="absolute top-[14%] left-[-7.25%] h-[95%] w-[114.5%] max-w-none"
      />

      <button
        type="button"
        disabled
        title="Leitor de NFT em breve"
        aria-label="Ler código de NFT (em breve)"
        className="absolute top-0 left-1/2 size-[65px] -translate-x-1/2 cursor-not-allowed"
      >
        <img src="/icons/tabbar-center.svg" alt="" className="absolute inset-0 size-full" />
        {scanIconPieces.map((piece) => (
          <img
            key={piece.src}
            src={piece.src}
            alt=""
            style={{ left: piece.left, top: piece.top, width: piece.width }}
            className="absolute max-w-none"
          />
        ))}
      </button>

      <Link
        to="/"
        aria-label="Início"
        aria-current={pathname === '/' ? 'page' : undefined}
        className={`${sideIconClasses} left-[8.7%]`}
      >
        <img src="/icons/tabbar-home.svg" alt="" width={16} height={17} />
      </Link>
      <Link
        to={accountPath}
        aria-label="Lista de interesse"
        className={`${sideIconClasses} left-[26.09%]`}
      >
        <img src="/icons/tabbar-heart.svg" alt="" width={20} height={18} />
      </Link>
      <Link
        to="/carrinho"
        aria-label={`Carrinho, ${cartCount} ${cartCount === 1 ? 'item' : 'itens'}`}
        className={`${sideIconClasses} left-[70.53%]`}
      >
        <img src="/icons/mobile-shop.svg" alt="" width={20} height={20} />
        {cartCount > 0 && (
          <span
            key={cartBump}
            className={cn(
              'absolute -top-2 -right-2 grid size-4 place-items-center rounded-full bg-primary text-tiny font-medium text-ink',
              cartBump > 0 && 'animate-bump',
            )}
          >
            <span data-testid="cart-count">{cartCount}</span>
          </span>
        )}
      </Link>
      <Link
        to={accountPath}
        aria-label={session.user ? 'Minha conta' : 'Entrar'}
        className={`${sideIconClasses} left-[85.51%]`}
      >
        <img src="/icons/mobile-user.svg" alt="" width={20} height={20} />
      </Link>
    </nav>
  )
}
