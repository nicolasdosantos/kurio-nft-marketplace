import { createFileRoute } from '@tanstack/react-router'
import { requireLogin } from '@/lib/auth-guard'
import { OrderPage } from '@/pages/OrderPage'

export const Route = createFileRoute('/pedidos/$orderId')({
  beforeLoad: requireLogin,
  component: OrderRoute,
})

function OrderRoute() {
  const { orderId } = Route.useParams()
  return <OrderPage orderId={orderId} />
}
