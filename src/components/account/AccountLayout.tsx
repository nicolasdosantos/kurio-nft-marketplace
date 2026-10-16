import type { ReactNode } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  Download,
  Heart,
  LogOut,
  MapPin,
  ShoppingCart,
  SquareActivity,
  TriangleAlert,
  User,
  type LucideIcon,
} from 'lucide-react'
import { useLogout } from '@/api/auth'
import { ComingSoon } from '@/components/layout/ComingSoon'
import { useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'

type Section = 'profile' | 'wallets'

interface NavItem {
  label: string
  icon: LucideIcon
  to?: '/perfil' | '/carteiras'
  section?: Section
}

// Atividade, Lista de interesse, Ofertas, Arquivos baixados e Suporte ficam fora do escopo.
const navItems: NavItem[] = [
  { label: 'Dados do perfil', icon: User, to: '/perfil', section: 'profile' },
  { label: 'Carteiras', icon: MapPin, to: '/carteiras', section: 'wallets' },
  { label: 'Atividade', icon: ShoppingCart },
  { label: 'Lista de interesse', icon: Heart },
  { label: 'Ofertas', icon: SquareActivity },
  { label: 'Arquivos baixados', icon: Download },
  { label: 'Suporte', icon: TriangleAlert },
]

function useLogoutAndLeave() {
  const logout = useLogout()
  const navigate = useNavigate()
  return {
    pending: logout.isPending,
    // Navega antes: a página é protegida e some assim que a sessão acaba.
    leave: () => {
      navigate({ to: '/' })
      logout.mutate()
    },
  }
}

interface AccountLayoutProps {
  section: Section
  children: ReactNode
}

export function AccountLayout({ section, children }: AccountLayoutProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const isTabletUp = useMediaQuery('(min-width: 768px)')
  const logout = useLogoutAndLeave()

  if (isDesktop) {
    return (
      // 41px: compensa o header do app, mais baixo que o dos frames (como no Pagamento).
      <main className="mx-auto grid w-full max-w-[1232px] grid-cols-[310px_minmax(0,1fr)] items-start gap-7 px-4 pt-[41px]">
        <nav
          aria-label="Menu da conta"
          className="flex flex-col bg-surface-card pt-[14px] pb-[7px]"
        >
          <p className="mb-[6px] px-2.5 text-body-lg leading-6 font-bold text-foreground">
            Meu perfil
          </p>
          <ul className="flex flex-col">
            {navItems.map((item) => (
              <li key={item.label}>
                <SidebarItem item={item} active={item.section === section} />
              </li>
            ))}
          </ul>
          <div className="h-px bg-border-soft" />
          <button
            type="button"
            onClick={logout.leave}
            disabled={logout.pending}
            className="flex h-[42px] items-center gap-2.5 pl-[17px] text-body leading-4 font-bold text-text-accent hover:bg-surface-raised disabled:opacity-60"
          >
            <LogOut aria-hidden="true" className="size-5" strokeWidth={1.5} />
            Sair
          </button>
        </nav>
        <div className="min-w-0">{children}</div>
      </main>
    )
  }

  return (
    <main
      className={cn(
        'mx-auto flex w-full min-w-0 flex-col gap-6',
        isTabletUp ? 'max-w-[1232px] px-4 pt-8' : 'max-w-[414px] px-7 pt-8 pb-12',
      )}
    >
      {!isTabletUp && (
        <div className="flex h-11 items-start justify-between gap-4">
          <p className="pt-[9px] text-[20px] leading-4 font-bold">Meu perfil</p>
          <button
            type="button"
            onClick={logout.leave}
            disabled={logout.pending}
            className="flex h-[35px] items-center gap-2 rounded-full border border-border bg-surface-raised px-4 text-body-sm font-bold text-text-accent disabled:opacity-60"
          >
            <LogOut aria-hidden="true" className="size-4" strokeWidth={1.5} />
            Sair
          </button>
        </div>
      )}
      {/* No celular a sidebar vira uma faixa de abas que rola na horizontal, como as do Início. */}
      <nav
        aria-label="Menu da conta"
        // relative: o texto sr-only "(em breve)" é absoluto e, sem isso, escapava da rolagem
        // da faixa e alargava a página no celular.
        className="relative -mx-7 min-w-0 overflow-x-auto px-7 md:mx-0 md:px-0"
      >
        <ul className="flex w-max gap-2">
          {navItems.map((item) => (
            <li key={item.label}>
              <StripItem item={item} active={item.section === section} />
            </li>
          ))}
          {isTabletUp && (
            <li>
              <button
                type="button"
                onClick={logout.leave}
                disabled={logout.pending}
                className="flex h-10 items-center gap-2 rounded-full border border-border px-4 text-body-sm font-bold whitespace-nowrap text-text-accent disabled:opacity-60"
              >
                <LogOut aria-hidden="true" className="size-4" strokeWidth={1.5} />
                Sair
              </button>
            </li>
          )}
        </ul>
      </nav>
      {children}
    </main>
  )
}

function SidebarItem({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  const content = (
    <>
      <Icon aria-hidden="true" className="size-[18px] text-secondary" strokeWidth={1.5} />
      {item.label}
    </>
  )
  const base =
    'relative flex h-[45px] items-center gap-[13px] pl-[17px] text-body leading-4 text-text-accent'

  if (!item.to) {
    return <ComingSoon className={base}>{content}</ComingSoon>
  }
  return (
    <Link
      to={item.to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        base,
        'hover:bg-surface-raised',
        active && 'before:absolute before:inset-y-0 before:left-0 before:w-1.5 before:bg-primary',
      )}
    >
      {content}
    </Link>
  )
}

function StripItem({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  const base =
    'flex h-10 items-center gap-2 rounded-full border px-4 text-body-sm whitespace-nowrap'
  const content = (
    <>
      <Icon aria-hidden="true" className="size-4" strokeWidth={1.5} />
      {item.label}
    </>
  )
  if (!item.to) {
    return (
      <ComingSoon className={cn(base, 'border-border text-text-secondary')}>{content}</ComingSoon>
    )
  }
  return (
    <Link
      to={item.to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        base,
        active
          ? 'border-primary bg-primary font-bold text-ink'
          : 'border-border text-text-accent hover:border-primary',
      )}
    >
      {content}
    </Link>
  )
}
