import { Link } from '@tanstack/react-router'
import { LoaderCircle } from 'lucide-react'
import type { Order } from '@/api/contracts/orders'
import { cn } from '@/lib/utils'

const panel = 'flex flex-col gap-3 rounded-[8px] border p-4 text-body-sm leading-5'
const secondaryAction =
  'flex h-10 items-center justify-center rounded-[6px] border border-primary px-4 font-bold text-text-accent hover:bg-primary/10'
const primaryAction =
  'flex h-10 items-center justify-center rounded-[6px] bg-primary px-4 font-bold text-ink hover:bg-text-accent'

// Mudanças de preço, estoque ou taxas entre o que o usuário revisou e a cotação atual.
export function QuoteChanges({ changes, valid }: { changes: string[]; valid: boolean }) {
  return (
    <div role="alert" data-testid="quote-changes" className={cn(panel, 'border-text-accent')}>
      <p className="font-bold text-text-accent">O pedido mudou enquanto você revisava:</p>
      {changes.length > 0 && (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-foreground">
          {changes.map((change) => (
            <li key={change}>{change}</li>
          ))}
        </ul>
      )}
      <p className="text-text-secondary">
        {valid
          ? 'Confira o novo total e confirme de novo.'
          : 'Ajuste os itens no carrinho para continuar.'}
      </p>
    </div>
  )
}

export function OrderPending({ status }: { status: Order['status'] | undefined }) {
  return (
    <div
      role="status"
      data-testid="order-progress"
      className={cn(panel, 'flex-row items-start border-primary bg-surface-card')}
    >
      <LoaderCircle
        aria-hidden="true"
        className="mt-0.5 size-5 shrink-0 animate-spin text-primary"
      />
      {status === 'confirmed' ? (
        <p className="font-bold">Pagamento confirmado. Abrindo o recibo...</p>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="font-bold">Pagamento pendente</p>
          <p className="text-text-secondary">
            Aguardando a confirmação da rede. Isso leva alguns segundos; não feche esta página.
          </p>
        </div>
      )}
    </div>
  )
}

const failureMessages: Record<NonNullable<Order['failureReason']>, string> = {
  PAYMENT_DECLINED:
    'A carteira recusou o pagamento. Nada foi cobrado e seu carrinho continua igual.',
  OUT_OF_STOCK: 'Uma das edições esgotou antes da confirmação. Nada foi cobrado.',
}

export function PaymentDeclined({
  reason,
  onRetry,
}: {
  reason: Order['failureReason']
  onRetry: () => void
}) {
  return (
    <div role="alert" data-testid="order-progress" className={cn(panel, 'border-destructive')}>
      <p className="font-bold text-destructive">Pagamento recusado</p>
      <p className="text-foreground">
        {reason ? failureMessages[reason] : 'O pagamento não foi concluído.'}
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={onRetry} className={primaryAction}>
          Tentar de novo
        </button>
        <Link to="/carrinho" className={secondaryAction}>
          Voltar ao carrinho
        </Link>
      </div>
    </div>
  )
}

// Sem resposta do servidor: o pedido pode ou não ter sido criado. Repetir com a mesma
// Idempotency-Key devolve o pedido existente em vez de criar outro.
export function NoResponse({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" data-testid="order-progress" className={cn(panel, 'border-destructive')}>
      <p className="font-bold text-destructive">Não recebemos a resposta do pagamento</p>
      <p className="text-foreground">
        Pode ter sido a conexão. Tentar de novo usa o mesmo pedido: você não será cobrado duas
        vezes.
      </p>
      <button type="button" onClick={onRetry} className={cn(primaryAction, 'self-start')}>
        Tentar de novo
      </button>
    </div>
  )
}
