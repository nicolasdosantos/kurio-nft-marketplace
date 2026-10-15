import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useIsDesktop } from '@/lib/use-media-query'
import { HomePage } from '@/pages/HomePage'

interface AuthScreenProps {
  title: string
  description: string
  onClose: () => void
  children: ReactNode
}

// No desktop o login/cadastro é um modal sobre a home (como no Figma);
// no mobile é uma página inteira. A URL é a mesma nos dois casos.
export function AuthScreen({ title, description, onClose, children }: AuthScreenProps) {
  const isDesktop = useIsDesktop()

  if (!isDesktop) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-4 px-7 pt-20 pb-40">
        <p className="text-center text-heading font-bold tracking-[1.4px] text-foreground">KURIO</p>
        <h1 className="mt-10 text-body-md font-bold text-foreground">{title}</h1>
        <p className="sr-only">{description}</p>
        {children}
      </main>
    )
  }

  return (
    <>
      <div aria-hidden="true" inert>
        <HomePage search={{}} onFiltersChange={() => {}} />
      </div>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="w-[500px] max-w-[calc(100%-2rem)] border-border-soft bg-surface-card p-8 sm:max-w-[500px]">
          <DialogTitle className="text-heading font-bold text-foreground">{title}</DialogTitle>
          <DialogDescription className="text-text-secondary">{description}</DialogDescription>
          {children}
        </DialogContent>
      </Dialog>
    </>
  )
}
