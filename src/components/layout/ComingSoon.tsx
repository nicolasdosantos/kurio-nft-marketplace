import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Itens do layout que não fazem parte da entrega: aparecem, mas deixam claro que não funcionam.
export function ComingSoon({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      aria-disabled="true"
      title="Em breve"
      className={cn('cursor-not-allowed opacity-60', className)}
    >
      {children}
      <span className="sr-only"> (em breve)</span>
    </span>
  )
}
