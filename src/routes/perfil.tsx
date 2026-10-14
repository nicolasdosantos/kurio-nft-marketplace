import { createFileRoute } from '@tanstack/react-router'
import { requireLogin } from '@/lib/auth-guard'
import { ProfilePage } from '@/pages/ProfilePage'

export const Route = createFileRoute('/perfil')({
  beforeLoad: requireLogin,
  component: ProfilePage,
})
