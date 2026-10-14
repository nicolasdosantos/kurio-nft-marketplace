import { createFileRoute, Link } from '@tanstack/react-router'

// Placeholder até a home real do Figma.
export const Route = createFileRoute('/')({
  component: HomePlaceholder,
})

function HomePlaceholder() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-heading font-bold text-text-accent">Kurio</h1>
      <Link
        to="/poc/$nftId"
        params={{ nftId: 'nft-1' }}
        className="text-text-secondary underline underline-offset-4"
      >
        Abrir PoC de tempo real
      </Link>
    </main>
  )
}
