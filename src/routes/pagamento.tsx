import { createFileRoute } from '@tanstack/react-router'
import { requireLogin } from '@/lib/auth-guard'
import { CheckoutPage } from '@/pages/CheckoutPage'

export const Route = createFileRoute('/pagamento')({
  beforeLoad: requireLogin,
  component: CheckoutPage,
})
