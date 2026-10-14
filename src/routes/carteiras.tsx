import { createFileRoute } from '@tanstack/react-router'
import { requireLogin } from '@/lib/auth-guard'
import { WalletsPage } from '@/pages/WalletsPage'

export const Route = createFileRoute('/carteiras')({
  beforeLoad: requireLogin,
  component: WalletsPage,
})
