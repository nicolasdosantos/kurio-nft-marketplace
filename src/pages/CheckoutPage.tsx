import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useConnectWallet, useWallets } from '@/api/account'
import { useCart, useQuote } from '@/api/cart'
import type { WalletSlot } from '@/api/contracts/account'
import type { Quote } from '@/api/contracts/cart'
import { createOrderRequestSchema } from '@/api/contracts/orders'
import { ApiRequestError } from '@/api/errors'
import { useCreateOrder } from '@/api/orders'
import { queryKeys } from '@/api/query-keys'
import { cacheOwner, useSession } from '@/session/session-store'

const collectorSchema = createOrderRequestSchema.shape.collector
type CollectorForm = z.input<typeof collectorSchema>

export function CheckoutPage() {
  const session = useSession()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const cartQuery = useCart()
  const walletsQuery = useWallets()
  const connectWallet = useConnectWallet()
  const createOrder = useCreateOrder()

  const [walletSlot, setWalletSlot] = useState<WalletSlot>('primary')
  const [connectedSlot, setConnectedSlot] = useState<WalletSlot | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [quoteChangedMessage, setQuoteChangedMessage] = useState('')
  // Uma chave por tentativa de compra; muda só quando a cotação muda.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())

  const wallet = walletsQuery.data?.[walletSlot] ?? null
  const network = wallet?.network ?? 'ethereum'
  const hasItems = (cartQuery.data?.items.length ?? 0) > 0
  const quoteQuery = useQuote(network, hasItems)
  const quote = quoteQuery.data

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

  function handleConnect() {
    if (!wallet) return
    connectWallet.mutate(
      { slot: walletSlot, network: wallet.network },
      { onSuccess: () => setConnectedSlot(walletSlot) },
    )
  }

  function handleQuoteOutdated(freshQuote: Quote) {
    queryClient.setQueryData(queryKeys.quote(cacheOwner(session), freshQuote.network), freshQuote)
    queryClient.invalidateQueries({ queryKey: queryKeys.cart(cacheOwner(session)) })
    setIdempotencyKey(crypto.randomUUID())
    setQuoteChangedMessage(
      `Preço, estoque ou taxas mudaram. O novo total é ${freshQuote.totalEth} ETH. Confira e confirme de novo.`,
    )
  }

  function submitOrder(collector: CollectorForm) {
    if (!quote) return
    setQuoteChangedMessage('')
    createOrder.mutate(
      {
        idempotencyKey,
        order: { quoteId: quote.id, walletSlot, network, collector },
      },
      {
        onSuccess: (order) => navigate({ to: '/pedidos/$orderId', params: { orderId: order.id } }),
        onError: (error) => {
          if (!(error instanceof ApiRequestError)) return
          const details = error.details as { quote?: Quote } | undefined
          if (
            (error.code === 'QUOTE_OUTDATED' || error.code === 'OUT_OF_STOCK') &&
            details?.quote
          ) {
            handleQuoteOutdated(details.quote)
          }
          if (error.code === 'WALLET_DISCONNECTED') setConnectedSlot(null)
          for (const [field, message] of Object.entries(error.fields)) {
            form.setError(field.replace('collector.', '') as keyof CollectorForm, { message })
          }
        },
      },
    )
  }

  if (cartQuery.isPending || walletsQuery.isPending) {
    return <main className="p-4">Carregando pagamento...</main>
  }
  if (!hasItems) {
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

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <h1 className="text-heading font-bold">Pagamento</h1>

      <form
        noValidate
        onSubmit={form.handleSubmit(() => setReviewing(true))}
        className="flex flex-col gap-3"
      >
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
                  setReviewing(false)
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
            disabled={!walletReady}
            className="rounded bg-primary p-2 text-primary-foreground disabled:opacity-50"
          >
            Revisar pedido
          </button>
        )}
      </form>

      <section aria-label="Resumo do pedido" className="flex flex-col gap-1">
        {quoteQuery.isPending && <p>Calculando total...</p>}
        {quote && (
          <dl className="grid grid-cols-2 gap-1" data-testid="checkout-summary">
            <dt>Subtotal</dt>
            <dd>{quote.subtotalEth} ETH</dd>
            <dt>Desconto</dt>
            <dd>(-) {quote.discountEth} ETH</dd>
            <dt>Taxa de rede</dt>
            <dd>{quote.networkFeeEth} ETH</dd>
            <dt className="font-bold">Total</dt>
            <dd className="font-bold" data-testid="checkout-total">
              {quote.totalEth} ETH
            </dd>
          </dl>
        )}
      </section>

      <div role="status" aria-live="polite">
        {quoteChangedMessage && <p className="text-text-accent">{quoteChangedMessage}</p>}
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
            onClick={() => setReviewing(false)}
            className="rounded border px-3 py-1"
          >
            Editar dados
          </button>
          <button
            type="button"
            disabled={createOrder.isPending || !quote?.valid || !walletReady}
            onClick={form.handleSubmit(submitOrder)}
            className="rounded bg-primary px-3 py-1 text-primary-foreground disabled:opacity-50"
          >
            {createOrder.isPending ? 'Enviando...' : 'Confirmar compra'}
          </button>
        </div>
      )}
    </main>
  )
}
