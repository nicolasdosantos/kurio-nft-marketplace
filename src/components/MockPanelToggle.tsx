import { lazy, Suspense, useEffect, useState } from 'react'

// O painel em si só é baixado quando alguém abre (?mockPanel=1 ou Ctrl+Shift+M).
const MockPanel = lazy(() =>
  import('@/components/MockPanel').then((module) => ({ default: module.MockPanel })),
)

export function MockPanelToggle() {
  const [open, setOpen] = useState(
    () => new URLSearchParams(window.location.search).get('mockPanel') === '1',
  )

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'm') {
        setOpen((current) => !current)
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  if (!open) return null

  return (
    <Suspense>
      <MockPanel onClose={() => setOpen(false)} />
    </Suspense>
  )
}
