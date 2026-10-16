import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { XIcon } from 'lucide-react'
import { ComingSoon } from '@/components/layout/ComingSoon'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import { HomePage } from '@/pages/HomePage'

type AuthMode = 'login' | 'register'

interface AuthLayoutProps {
  mode: AuthMode
  // Texto de apoio do modal (no mobile o Figma mostra só o título).
  description: string
  // Título da página no mobile.
  mobileTitle: string
  redirect?: string
  onClose: () => void
  // Campo que recebe o foco ao abrir o modal.
  initialFocusId: string
  children: (variant: 'desktop' | 'mobile') => ReactNode
}

const tabs: { mode: AuthMode; label: string; to: '/login' | '/cadastro' }[] = [
  { mode: 'login', label: 'Entrar', to: '/login' },
  { mode: 'register', label: 'Criar conta', to: '/cadastro' },
]

function SocialButtons({ variant }: { variant: 'desktop' | 'mobile' }) {
  const providers = [
    { name: 'Google', icon: '/icons/google.svg' },
    { name: 'Facebook', icon: '/icons/facebook.svg' },
  ]
  return (
    <div className={cn('flex flex-col', variant === 'desktop' ? 'gap-3' : 'gap-4')}>
      {providers.map((provider) => (
        // Login social fica fora do escopo: aparece desabilitado, sem simular sucesso.
        <ComingSoon
          key={provider.name}
          className={cn(
            'flex h-10 items-center justify-center gap-2 border border-border text-body-sm font-medium text-text-secondary',
            variant === 'desktop' ? 'rounded-[4px]' : 'rounded-[6px]',
          )}
        >
          <img src={provider.icon} alt="" width={18} height={18} />
          Continuar com {provider.name}
        </ComingSoon>
      ))}
    </div>
  )
}

// "Ou continue com" entre duas linhas, como no Figma.
function Divider({ fullBleed }: { fullBleed: boolean }) {
  return (
    <div className={cn('flex items-center gap-3', fullBleed && '-mx-20')}>
      <span className="h-px flex-1 bg-border" />
      <span className="text-caption text-foreground">Ou continue com</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

// No desktop (a partir de 768px) o login e o cadastro são um modal sobre a home;
// no mobile, uma página inteira. A URL é a mesma nos dois casos.
export function AuthLayout({
  mode,
  description,
  mobileTitle,
  redirect,
  onClose,
  initialFocusId,
  children,
}: AuthLayoutProps) {
  const isTabletUp = useMediaQuery('(min-width: 768px)')
  const other = tabs.find((tab) => tab.mode !== mode)!

  if (!isTabletUp) {
    return (
      <main className="mx-auto flex w-full max-w-[414px] flex-col px-7 pt-[136px] pb-12">
        <p className="text-center text-[32px] leading-6 font-bold tracking-[1.4px] text-foreground">
          KURIO
        </p>
        <h1 className="mt-24 text-center text-body-lg leading-4 font-bold text-foreground">
          {mobileTitle}
        </h1>
        <div className="mt-10">{children('mobile')}</div>
        <div className="mt-11 flex flex-col gap-4">
          <Divider fullBleed={false} />
          <SocialButtons variant="mobile" />
        </div>
        <p className="mt-11 text-center text-body text-text-secondary">
          {mode === 'login' ? 'Novo na Kurio? ' : 'Já tem uma conta? '}
          <Link to={other.to} search={{ redirect }} className="hover:underline">
            {mode === 'login' ? 'Crie uma conta' : 'Entre'}
          </Link>
        </p>
      </main>
    )
  }

  return (
    <>
      <div aria-hidden="true" inert>
        <HomePage search={{}} onFiltersChange={() => {}} />
      </div>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          showCloseButton={false}
          overlayClassName="bg-transparent supports-backdrop-filter:backdrop-blur-none"
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            document.getElementById(initialFocusId)?.focus()
          }}
          // No Figma o modal fica logo abaixo do header, não centralizado;
          // em telas baixas ele sobe e ganha rolagem, sem passar da borda.
          className="top-[clamp(16px,calc(50%-300px),160px)] flex max-h-[calc(100dvh-32px)] min-h-[min(600px,calc(100dvh-32px))] w-[500px] max-w-[calc(100%-2rem)] translate-y-0 flex-col gap-0 overflow-y-auto rounded-none border-0 border-b-[10px] border-primary bg-surface-card px-20 pt-12 pb-16 ring-0 sm:max-w-[500px]"
        >
          <DialogClose
            aria-label="Fechar"
            className="absolute top-2 right-[9px] grid size-6 place-items-center text-primary"
          >
            <XIcon aria-hidden="true" className="size-4" strokeWidth={2} />
          </DialogClose>

          <DialogTitle className="sr-only">
            {mode === 'login' ? 'Entrar' : 'Criar conta'}
          </DialogTitle>
          <nav aria-label="Entrar ou criar conta" className="flex items-center justify-center">
            {tabs.map((tab, index) => (
              <span key={tab.mode} className="flex items-center">
                {index > 0 && <span aria-hidden="true" className="mx-1.5 h-5 w-0.5 bg-primary" />}
                <Link
                  to={tab.to}
                  search={{ redirect }}
                  aria-current={tab.mode === mode ? 'page' : undefined}
                  className={cn(
                    'text-[20px] leading-5 hover:underline',
                    tab.mode === mode ? 'text-text-accent' : 'text-foreground',
                  )}
                >
                  {tab.label}
                </Link>
              </span>
            ))}
          </nav>

          <DialogDescription className="-mx-8 mt-[43px] text-center text-caption text-foreground">
            {description}
          </DialogDescription>

          <div className="mt-[26px]">{children('desktop')}</div>

          <div className="mt-6 flex flex-col gap-3">
            <Divider fullBleed />
            <SocialButtons variant="desktop" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
