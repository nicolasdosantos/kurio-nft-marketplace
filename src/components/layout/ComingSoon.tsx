import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Itens do layout que não fazem parte da entrega: têm a aparência normal, mas o tooltip
// "Em breve" (hover, foco e toque) deixa claro que não funcionam. Clicar não faz nada.
export function ComingSoon({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      tabIndex={0}
      aria-disabled="true"
      className={cn(
        'group/soon relative inline-flex cursor-not-allowed items-center rounded-sm',
        className,
      )}
    >
      {children}
      <span className="sr-only"> (em breve)</span>
      {/* hidden em vez de opacity: escondido, não ocupa espaço nem passa da borda da tela. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-full left-0 z-50 mt-1.5 hidden rounded-[4px] border border-border-soft bg-surface-dark px-2 py-1 text-caption-sm leading-4 font-medium whitespace-nowrap text-text-primary group-hover/soon:block group-focus/soon:block"
      >
        Em breve
      </span>
    </span>
  )
}
