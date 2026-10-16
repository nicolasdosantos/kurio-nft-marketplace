import { Link, useNavigate } from '@tanstack/react-router'
import { Lock } from 'lucide-react'
import { useLogout } from '@/api/auth'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSession } from '@/session/session-store'

const comingSoonItems = ['Atividade', 'Ofertas', 'Arquivos baixados', 'Suporte']

export function UserMenu() {
  const session = useSession()
  const logout = useLogout()
  const navigate = useNavigate()

  if (!session.user) return null

  return (
    // Sem modal: um menu não precisa esconder o resto da página com aria-hidden.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        data-testid="current-user"
        className="flex h-[35px] items-center gap-2 rounded-[6px] border border-primary px-3 text-body-md font-medium text-foreground"
      >
        {session.user.avatarUrl ? (
          <img
            src={session.user.avatarUrl}
            alt=""
            width={20}
            height={20}
            className="size-5 rounded-full object-cover"
          />
        ) : (
          <img src="/icons/mobile-user.svg" alt="" width={20} height={20} />
        )}
        <span className="max-w-32 truncate">{session.user.displayName}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 border-border-soft bg-surface-card">
        <DropdownMenuLabel className="text-text-secondary">Meu perfil</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link to="/perfil">Dados do perfil</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/carteiras">Carteiras</Link>
        </DropdownMenuItem>
        {comingSoonItems.map((label) => (
          // Não usa `disabled`: o Radix tiraria o item do foco, e o tooltip precisa aparecer no
          // foco também. preventDefault mantém o menu aberto e não faz nada.
          <DropdownMenuItem
            key={label}
            aria-disabled="true"
            onSelect={(event) => event.preventDefault()}
            className="group/soon cursor-not-allowed"
          >
            {label}
            <Lock aria-hidden="true" className="size-3 text-secondary" strokeWidth={2} />
            <span className="sr-only"> (em breve)</span>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 right-1.5 hidden -translate-y-1/2 rounded-[4px] border border-border-soft bg-surface-dark px-2 py-0.5 text-caption-sm leading-4 font-medium text-text-primary group-hover/soon:block group-focus/soon:block"
            >
              Em breve
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            // Navega antes: o menu desmonta assim que a sessão acaba.
            navigate({ to: '/' })
            logout.mutate()
          }}
        >
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
