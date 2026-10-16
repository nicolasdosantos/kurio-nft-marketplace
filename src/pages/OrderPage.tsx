import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { XIcon } from 'lucide-react'
import type { Order } from '@/api/contracts/orders'
import { ApiRequestError } from '@/api/errors'
import { useOrder } from '@/api/orders'
import { queryKeys } from '@/api/query-keys'
import { OrderReceipt } from '@/components/order/OrderReceipt'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { clearCheckoutAttempt, readCheckoutAttempt } from '@/lib/checkout-attempt'
import { formatReceiptDate } from '@/lib/display'
import { useMediaQuery } from '@/lib/use-media-query'
import { cacheOwner, useSession } from '@/session/session-store'

const statusLabels: Record<Order['status'], string> = {
  pending: 'Pagamento pendente',
  confirmed: 'Pedido confirmado',
  declined: 'Pagamento recusado',
}

export function OrderPage({ orderId }: { orderId: string }) {
  const orderQuery = useOrder(orderId)
  const session = useSession()
  const queryClient = useQueryClient()
  const isTabletUp = useMediaQuery('(min-width: 768px)')
  const status = orderQuery.data?.status
  // O comprovante abre sozinho; fechado, a página mostra o resumo e o botão para reabrir.
  const [receiptOpen, setReceiptOpen] = useState(true)
  const reopenButton = useRef<HTMLButtonElement>(null)
  const dialogContent = useRef<HTMLDivElement>(null)

  // Pedido resolvido (pelo socket ou pela consulta a cada 3s): o servidor já tirou do
  // carrinho só o que foi comprado, então o carrinho é buscado de novo. A tentativa
  // guardada para recuperar após refresh deixa de ser necessária.
  useEffect(() => {
    if (status !== 'confirmed' && status !== 'declined') return
    queryClient.invalidateQueries({ queryKey: queryKeys.cart(cacheOwner(session)) })
    const userId = session.user?.id
    if (userId && readCheckoutAttempt(userId)?.orderId === orderId) clearCheckoutAttempt()
  }, [status, orderId, queryClient, session])

  if (orderQuery.isError) {
    const errorStatus = orderQuery.error instanceof ApiRequestError ? orderQuery.error.status : 0
    return (
      <main className="mx-auto flex w-full max-w-[578px] flex-col items-start gap-4 px-7 pt-12 md:px-4">
        <h1 className="text-heading font-bold">
          {errorStatus === 403
            ? 'Este pedido é de outra conta'
            : errorStatus === 404
              ? 'Pedido não encontrado'
              : 'Erro ao carregar o pedido'}
        </h1>
        <p className="text-body-sm text-text-secondary">
          {errorStatus === 403
            ? 'Entre com a conta que fez a compra para ver o comprovante.'
            : errorStatus === 404
              ? 'Confira o link: não existe pedido com este código.'
              : orderQuery.error.message}
        </p>
        {errorStatus !== 403 && errorStatus !== 404 && (
          <button
            type="button"
            onClick={() => orderQuery.refetch()}
            className="h-10 rounded-[5px] bg-primary px-4 text-body-sm font-bold text-ink"
          >
            Tentar de novo
          </button>
        )}
        <Link to="/" className="text-body-sm font-bold text-text-accent underline">
          Voltar ao catálogo
        </Link>
      </main>
    )
  }

  const order = orderQuery.data

  if (!isTabletUp) {
    // Sem frame mobile no Figma: página inteira, como Carrinho e Pagamento no mobile.
    return (
      <main className="mx-auto flex w-full max-w-[414px] flex-col gap-4 px-7 pt-8 pb-12">
        <div className="flex h-11 items-start gap-6">
          <Link
            to="/"
            aria-label="Voltar ao catálogo"
            className="grid size-[35px] shrink-0 place-items-center rounded-full border border-border bg-surface-raised"
          >
            <img src="/icons/arrow-left.svg" alt="" width={20} height={20} />
          </Link>
          <p className="pt-[5px] text-[20px] leading-6 font-bold">Comprovante</p>
        </div>
        <div
          aria-label="Recibo"
          role="region"
          className="overflow-hidden rounded-[14px] border-b-[10px] border-primary bg-surface-card"
        >
          {order ? (
            <OrderReceipt order={order} variant="mobile" titleAs="h1" />
          ) : (
            <ReceiptSkeleton />
          )}
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-[1232px] flex-col gap-8 px-4 pt-[41px]">
      <nav aria-label="Trilha de navegação" className="text-body leading-4 font-bold">
        <Link to="/" className="hover:underline">
          Início
        </Link>{' '}
        / <span aria-current="page">Pedido</span>
      </nav>
      {/* Atrás do modal (fundo opaco, como no Figma): aparece quando o comprovante é fechado. */}
      <section className="flex max-w-[578px] flex-col items-start gap-3 rounded-[14px] bg-surface-card p-6">
        <h1 className="text-body-lg leading-6 font-bold text-foreground">
          {order ? statusLabels[order.status] : 'Carregando pedido...'}
        </h1>
        {order && (
          <p className="text-body-sm text-text-secondary">
            {formatReceiptDate(order.receipt.confirmedAt ?? order.createdAt)} · Total{' '}
            {order.receipt.totalEth} ETH
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            ref={reopenButton}
            type="button"
            onClick={() => setReceiptOpen(true)}
            className="h-10 rounded-[5px] bg-primary px-4 text-body-sm font-bold text-ink hover:bg-text-accent"
          >
            Ver comprovante
          </button>
          <Link
            to="/"
            className="flex h-10 items-center rounded-[5px] border border-primary px-4 text-body-sm font-bold text-text-accent"
          >
            Voltar ao catálogo
          </Link>
        </div>
      </section>

      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent
          ref={dialogContent}
          showCloseButton={false}
          aria-describedby={undefined}
          overlayClassName="bg-ink supports-backdrop-filter:backdrop-blur-none"
          // O modal abre sozinho, sem botão de origem: ao fechar, o foco vai para "Ver comprovante".
          // Foco no próprio modal ao abrir: o leitor de tela anuncia o título, sem anel no X.
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            dialogContent.current?.focus()
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            reopenButton.current?.focus()
          }}
          className="top-[clamp(16px,calc(50%-410px),166px)] block max-h-[calc(100dvh-32px)] w-[578px] max-w-[calc(100%-2rem)] translate-y-0 overflow-y-auto rounded-none border-0 border-b-[10px] border-primary bg-surface-card p-0 ring-0 sm:max-w-[578px]"
        >
          {/* Primeiro no DOM para receber o foco ao abrir (no canto, como no Figma). */}
          <DialogClose
            aria-label="Fechar"
            className="absolute top-[17px] right-[14px] grid size-[18px] place-items-center text-primary hover:text-text-accent"
          >
            <XIcon aria-hidden="true" className="size-3.5" strokeWidth={2} />
          </DialogClose>
          <section aria-label="Recibo">
            {order ? (
              <OrderReceipt order={order} variant="desktop" titleAs={DialogTitle} />
            ) : (
              <>
                <DialogTitle className="sr-only">Carregando pedido</DialogTitle>
                <ReceiptSkeleton />
              </>
            )}
          </section>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function ReceiptSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4 p-6">
      <Skeleton className="mx-auto size-20" />
      <Skeleton className="mx-auto h-4 w-64" />
      <Skeleton className="h-14" />
      <Skeleton className="h-[70px]" />
      <Skeleton className="h-[70px]" />
      <Skeleton className="h-24" />
    </div>
  )
}
