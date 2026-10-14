import { Link } from '@tanstack/react-router'
import { ApiRequestError } from '@/api/errors'
import { useOrder } from '@/api/orders'

const failureMessages = {
  PAYMENT_DECLINED: 'O pagamento foi recusado pela carteira.',
  OUT_OF_STOCK: 'Uma das edições esgotou antes da confirmação.',
}

export function OrderPage({ orderId }: { orderId: string }) {
  const orderQuery = useOrder(orderId)

  if (orderQuery.isPending) return <main className="p-4">Carregando pedido...</main>

  if (orderQuery.isError) {
    const status = orderQuery.error instanceof ApiRequestError ? orderQuery.error.status : 0
    return (
      <main className="flex flex-col gap-2 p-4">
        <h1 className="text-heading font-bold">
          {status === 404 || status === 403 ? 'Pedido não encontrado' : 'Erro ao carregar o pedido'}
        </h1>
        <Link to="/" className="underline">
          Voltar para o mercado
        </Link>
      </main>
    )
  }

  const order = orderQuery.data
  const { receipt } = order

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-3 p-4">
      <h1 className="text-heading font-bold">Pedido</h1>
      <p role="status" aria-live="polite" data-testid="order-status">
        {order.status === 'pending' && 'Aguardando confirmação do pagamento...'}
        {order.status === 'confirmed' && 'Seus NFTs agora estão na sua carteira.'}
        {order.status === 'declined' &&
          `Pedido recusado. ${order.failureReason ? failureMessages[order.failureReason] : ''}`}
      </p>

      {order.status === 'confirmed' && (
        <section aria-label="Recibo" className="flex flex-col gap-2">
          <dl className="grid grid-cols-2 gap-1">
            <dt>ID da transação</dt>
            <dd className="break-all">{receipt.transactionHash}</dd>
            <dt>Data</dt>
            <dd>
              {receipt.confirmedAt &&
                new Date(receipt.confirmedAt).toLocaleDateString('pt-BR', { dateStyle: 'medium' })}
            </dd>
            <dt>Carteira</dt>
            <dd>{receipt.wallet.type}</dd>
          </dl>
          <ul>
            {receipt.items.map((receiptItem) => (
              <li key={`${receiptItem.nftId}-${receiptItem.editionId}`}>
                {receiptItem.name} · {receiptItem.editionLabel} · x{receiptItem.quantity} ·{' '}
                {receiptItem.lineTotalEth} ETH
              </li>
            ))}
          </ul>
          <p>Taxa de rede: {receipt.networkFeeEth} ETH</p>
          <p className="font-bold">Total: {receipt.totalEth} ETH</p>
          <p className="text-body-sm text-text-secondary">
            Transação simulada: o hash acima não existe em nenhum explorer de blockchain.
          </p>
        </section>
      )}

      {order.status === 'declined' && (
        <Link to="/carrinho" className="underline">
          Voltar ao carrinho
        </Link>
      )}
    </main>
  )
}
