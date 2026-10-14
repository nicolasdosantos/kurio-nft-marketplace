import { useEffect, useRef, type ReactNode } from 'react'
import { useIsDesktop } from '@/lib/use-media-query'
import { CatalogPage } from '@/pages/CatalogPage'

interface AuthScreenProps {
  title: string
  onClose: () => void
  children: ReactNode
}

// No desktop o login/cadastro é um modal sobre a home (como no Figma);
// no mobile é uma página inteira. A URL é a mesma nos dois casos.
export function AuthScreen({ title, onClose, children }: AuthScreenProps) {
  const isDesktop = useIsDesktop()
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (isDesktop && dialog && !dialog.open) dialog.showModal()
  }, [isDesktop])

  if (!isDesktop) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
        <h1 className="text-heading font-bold">{title}</h1>
        {children}
      </main>
    )
  }

  return (
    <>
      <div aria-hidden="true" inert>
        <CatalogPage search={{}} onFiltersChange={() => {}} onPageChange={() => {}} />
      </div>
      <dialog
        ref={dialogRef}
        aria-labelledby="auth-title"
        onCancel={(event) => {
          event.preventDefault()
          onClose()
        }}
        className="m-auto w-[500px] rounded-lg border border-border-soft bg-surface-card p-6 text-text-primary backdrop:bg-ink/80"
      >
        <div className="mb-4 flex items-center justify-between">
          <h1 id="auth-title" className="text-heading font-bold">
            {title}
          </h1>
          <button type="button" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        {children}
      </dialog>
    </>
  )
}
