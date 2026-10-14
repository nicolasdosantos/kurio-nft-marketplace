import { createFileRoute } from '@tanstack/react-router'

// Temporary placeholder for the setup phase; the real home page comes in a later phase.
export const Route = createFileRoute('/')({
  component: SetupCheck,
})

function SetupCheck() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-ink font-mono text-text-primary">
      <h1 className="text-heading font-bold text-text-accent">Kurio — setup OK</h1>
    </main>
  )
}
