import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useConnectWallet, useWallets } from '@/api/account'
import { useCart, useQuote } from '@/api/cart'
import type { WalletSlot } from '@/api/contracts/account'
import type { Quote } from '@/api/contracts/cart'
import { createOrderRequestSchema, type CreateOrderRequest } from '@/api/contracts/orders'
import { ApiRequestError } from '@/api/errors'
import { useCreateOrder } from '@/api/orders'
import { queryKeys } from '@/api/query-keys'
import {
  clearCheckoutAttempt,
  readCheckoutAttempt,
  saveCheckoutAttempt,
} from '@/lib/checkout-attempt'
import { cacheOwner, useSession } from '@/session/session-store'

const collectorSchema = createOrderRequestSchema.shape.collector
type CollectorForm = z.input<typeof collectorSchema>

// O que o usuário revisou: se algo disso mudar, ele precisa confirmar de novo.
function sameQuote(reviewed: Quote, current: Quote) {
  return (
    reviewed.valid === current.valid &&
    reviewed.totalEth === current.totalEth &&
    reviewed.networkFeeEth === current.networkFeeEth &&
    reviewed.discountEth === current.discountEth &&
    reviewed.lines.length === current.lines.length &&
    reviewed.lines.every((line) => {
      const match = current.lines.find((item) => item.itemId === line.itemId)
      return (
        match !== undefined &&
        match.quantity === line.quantity &&
        match.unitPriceEth === line.unitPriceEth &&
        match.issues.join() === line.issues.join()
      )
    })
  )
}

function changedMessage(quote: Quote) {
  return `Preço, estoque ou taxas mudaram. O novo total é ${quote.totalEth} ETH. Confira e confirme de novo.`
}

export function CheckoutPage() {
  const session = useSession()
  const userId = session.user?.id ?? ''
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const cartQuery = useCart()
  const walletsQuery = useWallets()
  const connectWallet = useConnectWallet()
  const createOrder = useCreateOrder()

  const [walletSlot, setWalletSlot] = useState<WalletSlot>('primary')
  const [connectedSlot, setConnectedSlot] = useState<WalletSlot | null>(null)
  // A cotação que o usuário viu na revisão; null enquanto ainda está preenchendo os dados.
  const [reviewedQuote, setReviewedQuote] = useState<Quote | null>(null)
  const [revalidating, setRevalidating] = useState(false)
  const [quoteChangedMessage, setQuoteChangedMessage] = useState('')

  const wallet = walletsQuery.data?.[walletSlot] ?? null
  const network = wallet?.network ?? 'ethereum'
  const hasItems = (cartQuery.data?.items.length ?? 0) > 0
  const quoteQuery = useQuote(network, hasItems)
  const quote = quoteQuery.data
  const reviewing = reviewedQuote !== null
  // Um nft.updated pode refazer a cotação no meio da revisão: aí o total exibido muda
  // e a confirmação anterior deixa de valer.
  const changedWhileReviewing =
    reviewedQuote !== null && quote !== undefined && !sameQuote(reviewedQuote, quote)
  const submitting = revalidating || createOrder.isPending

  const form = useForm<CollectorForm>({
    resolver: zodResolver(collectorSchema),
    values: {
      displayName: session.user?.displayName ?? '',
      username: session.user?.username ?? '',
      email: session.user?.email ?? '',
      note: '',
    },
    resetOptions: { keepDirtyValues: true },
  })

  function sendOrder(idempotencyKey: string, order: CreateOrderRequest) {
    saveCheckoutAttempt({ userId, idempotencyKey, order })
    createOrder.mutate(
      { idempotencyKey, order },
      {
        onSuccess: (createdOrder) => {
          saveCheckoutAttempt({ userId, idempotencyKey, order, orderId: createdOrder.id })
          navigate({ to: '/pedidos/$orderId', params: { orderId: createdOrder.id } })
        },
        onError: (error) => {
          if (!(error instanceof ApiRequestError)) return
          // Erro de rede depois das tentativas: a tentativa fica guardada para retomar
          // com a mesma chave. Qualquer resposta do servidor encerra esta tentativa.
          if (error.status !== 0) clearCheckoutAttempt()
          const details = error.details as { quote?: Quote } | undefined
          if (
            (error.code === 'QUOTE_OUTDATED' || error.code === 'OUT_OF_STOCK') &&
            details?.quote
          ) {
            queryClient.setQueryData(
              queryKeys.quote(cacheOwner(session), details.quote.network),
              details.quote,
            )
            queryClient.invalidateQueries({ queryKey: queryKeys.cart(cacheOwner(session)) })
            setReviewedQuote(details.quote)
            setQuoteChangedMessage(changedMessage(details.quote))
          }
          if (error.code === 'WALLET_DISCONNECTED') setConnectedSlot(null)
          for (const [field, message] of Object.entries(error.fields)) {
            form.setError(field.replace('collector.', '') as keyof CollectorForm, { message })
          }
        },
      },
    )
  }

  // Refresh no meio do envio: reenvia a mesma tentativa (mesma chave e mesmo corpo).
  // O servidor devolve o pedido que já existia; se o primeiro envio nem chegou, cria agora.
  const [pendingAttempt] = useState(() => readCheckoutAttempt(userId))
  const resumed = useRef(false)
  useEffect(() => {
    if (resumed.current || !pendingAttempt) return
    resumed.current = true
    sendOrder(pendingAttempt.idempotencyKey, pendingAttempt.order)
    // sendOrder só é chamado uma vez, ao abrir a página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAttempt])
  const resumeMessage =
    pendingAttempt && createOrder.isPending ? 'Retomando a compra que estava em andamento...' : ''

  function handleConnect() {
    if (!wallet) return
    connectWallet.mutate(
      { slot: walletSlot, network: wallet.network },
      { onSuccess: () => setConnectedSlot(walletSlot) },
    )
  }

  function startReview() {
    if (!quote) return
    setQuoteChangedMessage('')
    setReviewedQuote(quote)
  }

  function acceptNewQuote() {
    if (!quote) return
    setQuoteChangedMessage('')
    setReviewedQuote(quote)
  }

  async function confirmPurchase(collector: CollectorForm) {
    if (!reviewedQuote || submitting) return
    setQuoteChangedMessage('')
    // Revalida a cotação na API antes de confirmar: preço, estoque, cupom e taxas.
    setRevalidating(true)
    const fresh = await quoteQuery.refetch()
    setRevalidating(false)
    if (!fresh.data) return
    if (!fresh.data.valid || !sameQuote(reviewedQuote, fresh.data)) {
      setReviewedQuote(fresh.data)
      setQuoteChangedMessage(changedMessage(fresh.data))
      return
    }
    // Uma chave nova por tentativa de compra; os retries automáticos usam a mesma.
    sendOrder(crypto.randomUUID(), {
      quoteId: fresh.data.id,
      walletSlot,
      network,
      collector: { ...collector, note: collector.note || undefined },
    })
  }

  if (cartQuery.isPending || walletsQuery.isPending) {
    return <main className="p-4">Carregando pagamento...</main>
  }
  if (!hasItems && !createOrder.isPending && !pendingAttempt) {
    return (
      <main className="p-4">
        Seu carrinho está vazio.{' '}
        <Link to="/" className="underline">
          Explorar o mercado
        </Link>
      </main>
    )
  }

  const { errors } = form.formState
  const walletReady = wallet !== null && connectedSlot === walletSlot
  const shownQuote = reviewedQuote ?? quote

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <h1 className="text-heading font-bold">Pagamento</h1>

      <form noValidate onSubmit={form.handleSubmit(startReview)} className="flex flex-col gap-3">
        <h2 className="font-bold">Perfil do colecionador</h2>
        {(
          [
            ['displayName', 'Nome de exibição'],
            ['username', 'Nome de usuário'],
            ['email', 'E-mail'],
          ] as const
        ).map(([field, label]) => (
          <div key={field} className="flex flex-col">
            <label htmlFor={`checkout-${field}`}>{label}</label>
            <input
              id={`checkout-${field}`}
              {...form.register(field)}
              aria-invalid={errors[field] ? true : undefined}
              aria-describedby={errors[field] ? `checkout-${field}-error` : undefined}
              className="rounded border border-input bg-ink p-1"
            />
            {errors[field] && (
              <span id={`checkout-${field}-error`} className="text-destructive">
                {errors[field].message}
              </span>
            )}
          </div>
        ))}
        <label htmlFor="checkout-note">Observação do colecionador (opcional)</label>
        <textarea
          id="checkout-note"
          {...form.register('note')}
          className="rounded border border-input bg-ink p-1"
        />

        <h2 className="font-bold">Carteira e rede</h2>
        {!walletsQuery.data?.primary && (
          <p>
            Você ainda não tem carteira.{' '}
            <Link to="/carteiras" className="underline">
              Cadastrar carteira
            </Link>
          </p>
        )}
        {(['primary', 'secondary'] as const).map((slot) => {
          const slotWallet = walletsQuery.data?.[slot]
          if (!slotWallet) return null
          return (
            <label key={slot} className="flex gap-2">
              <input
                type="radio"
                name="wallet"
                checked={walletSlot === slot}
                onChange={() => {
                  setWalletSlot(slot)
                  setReviewedQuote(null)
                }}
              />
              {slotWallet.nickname} ({slotWallet.walletType}, {slotWallet.network})
            </label>
          )
        })}
        {wallet && (
          <div className="flex items-center gap-2">
            <span data-testid="wallet-status">
              {walletReady ? 'Carteira conectada' : 'Carteira desconectada'}
            </span>
            {!walletReady && (
              <button
                type="button"
                onClick={handleConnect}
                disabled={connectWallet.isPending}
                className="rounded border border-primary px-2"
              >
                Conectar carteira
              </button>
            )}
          </div>
        )}
        {connectWallet.isError && (
          <p role="alert" className="text-destructive">
            {connectWallet.error.message}
          </p>
        )}

        {!reviewing && (
          <button
            type="submit"
            disabled={!walletReady || !quote}
            className="rounded bg-primary p-2 text-primary-foreground disabled:opacity-50"
          >
            Revisar pedido
          </button>
        )}
      </form>

      <section aria-label="Resumo do pedido" className="flex flex-col gap-1">
        {quoteQuery.isPending && <p>Calculando total...</p>}
        {shownQuote && (
          <dl className="grid grid-cols-2 gap-1" data-testid="checkout-summary">
            <dt>Subtotal</dt>
            <dd>{shownQuote.subtotalEth} ETH</dd>
            <dt>Desconto</dt>
            <dd>(-) {shownQuote.discountEth} ETH</dd>
            <dt>Taxa de rede</dt>
            <dd>{shownQuote.networkFeeEth} ETH</dd>
            <dt className="font-bold">Total</dt>
            <dd className="font-bold" data-testid="checkout-total">
              {shownQuote.totalEth} ETH
            </dd>
          </dl>
        )}
      </section>

      <div role="status" aria-live="polite" data-testid="checkout-status">
        {resumeMessage && <p>{resumeMessage}</p>}
        {quoteChangedMessage && <p className="text-text-accent">{quoteChangedMessage}</p>}
        {!quoteChangedMessage && changedWhileReviewing && quote && (
          <p className="text-text-accent">{changedMessage(quote)}</p>
        )}
      </div>
      {createOrder.isError && !quoteChangedMessage && (
        <p role="alert" className="text-destructive">
          {createOrder.error.message}
        </p>
      )}

      {reviewing && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setReviewedQuote(null)}
            className="rounded border px-3 py-1"
          >
            Editar dados
          </button>
          {changedWhileReviewing ? (
            <button
              type="button"
              onClick={acceptNewQuote}
              className="rounded bg-primary px-3 py-1 text-primary-foreground"
            >
              Revisar novo total
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting || !reviewedQuote.valid || !walletReady}
              onClick={form.handleSubmit(confirmPurchase)}
              className="rounded bg-primary px-3 py-1 text-primary-foreground disabled:opacity-50"
            >
              {submitting ? 'Enviando...' : 'Confirmar compra'}
            </button>
          )}
        </div>
      )}
    </main>
  )
}
