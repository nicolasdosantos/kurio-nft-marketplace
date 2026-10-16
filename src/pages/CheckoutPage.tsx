import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useCanGoBack, useNavigate, useRouter } from '@tanstack/react-router'
import { useConnectWallet, useDisconnectWallet, useWallets } from '@/api/account'
import { useCart, useQuote } from '@/api/cart'
import type { WalletSlot, WalletType } from '@/api/contracts/account'
import type { Quote } from '@/api/contracts/cart'
import { createOrderRequestSchema, type CreateOrderRequest } from '@/api/contracts/orders'
import { isRetryableError } from '@/api/errors'
import { useCreateOrder, useOrder } from '@/api/orders'
import { queryKeys } from '@/api/query-keys'
import { FieldLabel, FormField, FormTextarea } from '@/components/form/FormField'
import { CheckoutItems } from '@/components/checkout/CheckoutItems'
import {
  NoResponse,
  OrderPending,
  PaymentDeclined,
  QuoteChanges,
} from '@/components/checkout/CheckoutPanels'
import { ProviderOptions, WalletCards, WalletStatus } from '@/components/checkout/WalletPicker'
import { ComingSoon } from '@/components/layout/ComingSoon'
import { Skeleton } from '@/components/ui/skeleton'
import {
  clearCheckoutAttempt,
  readCheckoutAttempt,
  saveCheckoutAttempt,
} from '@/lib/checkout-attempt'
import { walletSlotLabels, walletTypeLabels } from '@/lib/display'
import { describeQuoteChanges, sameQuote } from '@/lib/quote-changes'
import { useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import { cacheOwner, useSession } from '@/session/session-store'

const collectorSchema = createOrderRequestSchema.shape.collector
type CollectorForm = z.input<typeof collectorSchema>

const CONNECT_BUTTON_ID = 'checkout-connect'
const CONFIRM_BUTTON_ID = 'checkout-confirm'

const collectorFields = [
  { name: 'displayName', label: 'Nome de exibição', autoComplete: 'name', type: 'text' },
  { name: 'username', label: 'Nome de usuário', autoComplete: 'username', type: 'text' },
  { name: 'email', label: 'E-mail', autoComplete: 'email', type: 'email' },
] as const

export function CheckoutPage() {
  const session = useSession()
  const userId = session.user?.id ?? ''
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const router = useRouter()
  const canGoBack = useCanGoBack()
  const isTabletUp = useMediaQuery('(min-width: 768px)')
  const variant = isTabletUp ? 'desktop' : 'mobile'

  const cartQuery = useCart()
  const walletsQuery = useWallets()
  const connectWallet = useConnectWallet()
  const disconnectWallet = useDisconnectWallet()
  const createOrder = useCreateOrder()

  // Refresh no meio do envio: a tentativa guardada é reenviada ao abrir a página.
  const [pendingAttempt] = useState(() => readCheckoutAttempt(userId))

  const [walletSlot, setWalletSlot] = useState<WalletSlot>(
    pendingAttempt?.order.walletSlot ?? 'primary',
  )
  const wallet = walletsQuery.data?.[walletSlot] ?? null
  // O app de conexão começa no app em que a carteira foi cadastrada.
  const [providerChoice, setProviderChoice] = useState<WalletType | null>(null)
  const provider = providerChoice ?? wallet?.walletType ?? null
  const [connection, setConnection] = useState<{ slot: WalletSlot; provider: WalletType } | null>(
    null,
  )
  const connected = connection?.slot === walletSlot && connection.provider === provider
  const [walletMessage, setWalletMessage] = useState('')

  const network = wallet?.network ?? 'ethereum'
  const items = cartQuery.data?.items ?? []
  const hasItems = items.length > 0
  const quoteQuery = useQuote(network, hasItems)
  const quote = quoteQuery.data

  const [orderId, setOrderId] = useState<string | null>(null)
  const orderQuery = useOrder(orderId)
  const orderStatus = orderQuery.data?.status
  // Pedido criado e ainda não recusado: a tela fica travada até ele se resolver.
  const orderInProgress = orderId !== null && orderStatus !== 'declined'

  // A cotação que o usuário está vendo e vai confirmar. Ao trocar de carteira (e de rede)
  // a nova cotação vira a revisada; mudanças vindas de fora (socket, revalidação) não.
  const [reviewedQuote, setReviewedQuote] = useState<Quote | null>(null)
  if (quote && (reviewedQuote === null || reviewedQuote.network !== quote.network)) {
    setReviewedQuote(quote)
  }
  const quoteChanged =
    !orderInProgress &&
    reviewedQuote !== null &&
    quote !== undefined &&
    reviewedQuote.network === quote.network &&
    !sameQuote(reviewedQuote, quote)
  const changes = quoteChanged ? describeQuoteChanges(reviewedQuote, quote, items) : []

  const [revalidating, setRevalidating] = useState(false)
  const [notice, setNotice] = useState('')
  const locked = revalidating || createOrder.isPending || orderInProgress
  const noResponse = createOrder.isError && isRetryableError(createOrder.error)

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
  const { errors } = form.formState

  function sendOrder(idempotencyKey: string, order: CreateOrderRequest) {
    // A partir daqui quem informa é o painel do pedido; a mensagem anterior sai.
    setNotice('')
    setWalletMessage('')
    saveCheckoutAttempt({ userId, idempotencyKey, order })
    createOrder.mutate(
      { idempotencyKey, order },
      {
        onSuccess: (createdOrder) => {
          saveCheckoutAttempt({ userId, idempotencyKey, order, orderId: createdOrder.id })
          setOrderId(createdOrder.id)
        },
        onError: (error) => {
          // Sem resposta (rede, timeout, 5xx): a tentativa fica guardada e o "Tentar de
          // novo" reenvia com a mesma chave. Qualquer outra resposta encerra a tentativa.
          if (isRetryableError(error)) return
          clearCheckoutAttempt()
          const details = error.details as { quote?: Quote } | undefined
          if (
            (error.code === 'QUOTE_OUTDATED' || error.code === 'OUT_OF_STOCK') &&
            details?.quote
          ) {
            // A cotação nova entra no cache; se for diferente da revisada, o aviso de
            // mudanças aparece e pede nova confirmação.
            queryClient.setQueryData(
              queryKeys.quote(cacheOwner(session), details.quote.network),
              details.quote,
            )
            queryClient.invalidateQueries({ queryKey: queryKeys.cart(cacheOwner(session)) })
            if (reviewedQuote && sameQuote(reviewedQuote, details.quote)) setNotice(error.message)
            return
          }
          if (error.code === 'WALLET_DISCONNECTED') {
            setConnection(null)
            setNotice('A carteira desconectou antes do envio. Conecte de novo e confirme a compra.')
            return
          }
          const fieldErrors = Object.entries(error.fields)
          for (const [field, message] of fieldErrors) {
            form.setError(field.replace('collector.', '') as keyof CollectorForm, { message })
          }
          if (fieldErrors.length === 0) setNotice(error.message)
        },
      },
    )
  }

  const resumed = useRef(false)
  useEffect(() => {
    if (resumed.current || !pendingAttempt) return
    resumed.current = true
    sendOrder(pendingAttempt.idempotencyKey, pendingAttempt.order)
    // sendOrder só é chamado uma vez, ao abrir a página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAttempt])

  // Pedido resolvido (socket ou consulta a cada 3s): confirmado abre o recibo; recusado
  // fica aqui, com o caminho de volta. Em nenhum dos dois a tentativa precisa ser guardada.
  useEffect(() => {
    if (!orderId) return
    if (orderStatus === 'confirmed') {
      navigate({ to: '/pedidos/$orderId', params: { orderId }, replace: true })
    } else if (orderStatus === 'declined') {
      clearCheckoutAttempt()
    }
  }, [orderId, orderStatus, navigate])

  function selectWallet(slot: WalletSlot) {
    setWalletSlot(slot)
    setProviderChoice(null)
    setWalletMessage('')
    connectWallet.reset()
  }

  function selectProvider(type: WalletType) {
    setProviderChoice(type)
    setWalletMessage('')
    connectWallet.reset()
  }

  function handleConnect() {
    if (!wallet || !provider) return
    const slot = walletSlot
    setNotice('')
    setWalletMessage(`Aguardando a aprovação no ${walletTypeLabels[provider]}...`)
    connectWallet.mutate(
      { slot, network: wallet.network, walletType: provider },
      {
        onSuccess: () => {
          setConnection({ slot, provider })
          setWalletMessage(
            `Carteira ${walletSlotLabels[slot]} conectada pelo ${walletTypeLabels[provider]}.`,
          )
        },
        onError: () => setWalletMessage(''),
      },
    )
  }

  function handleDisconnect() {
    const slot = walletSlot
    disconnectWallet.mutate(slot, {
      onSuccess: () => {
        setConnection(null)
        setWalletMessage(`Carteira ${walletSlotLabels[slot]} desconectada.`)
      },
    })
  }

  async function confirmPurchase(collector: CollectorForm) {
    if (locked || !reviewedQuote) return
    setNotice('')
    if (!wallet) {
      setNotice('Cadastre uma carteira para pagar.')
      return
    }
    if (!connected) {
      setNotice('Conecte a carteira antes de confirmar a compra.')
      document.getElementById(CONNECT_BUTTON_ID)?.focus()
      return
    }
    // Revalida a cotação na API antes de confirmar: preço, estoque, cupom e taxas.
    setRevalidating(true)
    const fresh = await quoteQuery.refetch()
    setRevalidating(false)
    if (!fresh.data) {
      setNotice('Não foi possível conferir o total agora. Tente de novo.')
      return
    }
    // Mudou: o aviso de mudanças aparece e o botão passa a pedir a nova revisão.
    if (!fresh.data.valid || !sameQuote(reviewedQuote, fresh.data)) return

    // Uma chave nova por tentativa de compra; os retries automáticos usam a mesma.
    sendOrder(crypto.randomUUID(), {
      quoteId: fresh.data.id,
      walletSlot,
      network,
      collector: { ...collector, note: collector.note || undefined },
    })
  }

  function acceptNewQuote() {
    if (!quote) return
    setReviewedQuote(quote)
    setNotice('')
    setWalletMessage('Novo total aceito. Confirme a compra para continuar.')
  }

  function retrySameAttempt() {
    const attempt = readCheckoutAttempt(userId)
    if (attempt) sendOrder(attempt.idempotencyKey, attempt.order)
  }

  function retryAfterDecline() {
    setOrderId(null)
    createOrder.reset()
    setNotice('')
    if (quote) setReviewedQuote(quote)
    requestAnimationFrame(() => document.getElementById(CONFIRM_BUTTON_ID)?.focus())
  }

  function handleBack() {
    if (canGoBack) router.history.back()
    else navigate({ to: '/carrinho' })
  }

  const statusMessage =
    pendingAttempt && createOrder.isPending
      ? 'Retomando a compra que estava em andamento...'
      : revalidating
        ? 'Conferindo preço, estoque e taxas...'
        : walletMessage

  const loading = cartQuery.isPending || walletsQuery.isPending
  const empty = !loading && !hasItems && orderId === null && !pendingAttempt

  let content
  if (loading) {
    content = <CheckoutSkeleton variant={variant} />
  } else if (cartQuery.isError || walletsQuery.isError) {
    content = (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-lg bg-surface-card p-6">
        <p className="text-body-md font-bold">Não foi possível carregar o pagamento.</p>
        <button
          type="button"
          onClick={() => {
            cartQuery.refetch()
            walletsQuery.refetch()
          }}
          className="h-10 rounded-[6px] bg-primary px-4 text-body-sm font-bold text-ink"
        >
          Tentar de novo
        </button>
      </div>
    )
  } else if (empty) {
    content = (
      <div className="flex flex-col items-center gap-4 rounded-lg bg-surface-card px-6 py-12 text-center">
        <p className="text-body-md font-bold">Seu carrinho está vazio.</p>
        <Link
          to="/"
          className="flex h-10 items-center rounded-[6px] bg-primary px-5 text-body-sm font-bold text-ink hover:bg-text-accent"
        >
          Explorar o mercado
        </Link>
      </div>
    )
  } else {
    const wallets = walletsQuery.data!

    const collectorSection = (
      <section aria-labelledby="collector-title" className="flex flex-col gap-3">
        <h2
          id="collector-title"
          className={cn(
            'font-bold',
            isTabletUp ? 'text-[17px] leading-4' : 'text-body-md leading-4',
          )}
        >
          Perfil do colecionador
        </h2>
        <fieldset disabled={locked} className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {collectorFields.map((field) => (
            <FormField
              key={field.name}
              id={`checkout-${field.name}`}
              label={field.label}
              variant={variant}
              type={field.type}
              autoComplete={field.autoComplete}
              required
              error={errors[field.name]?.message}
              {...form.register(field.name)}
            />
          ))}
          {/* Programa de indicação fora do escopo. */}
          <div className="flex flex-col">
            <FieldLabel htmlFor="checkout-referral">Código de indicação</FieldLabel>
            <ComingSoon className="block">
              <input
                id="checkout-referral"
                disabled
                placeholder="Em breve"
                className={cn(
                  'w-full border border-field-border bg-transparent px-3 text-body-sm placeholder:text-secondary',
                  isTabletUp ? 'h-10 rounded-[3px]' : 'h-[50px] rounded-[10px] bg-surface-card',
                )}
              />
            </ComingSoon>
          </div>
        </fieldset>
      </section>
    )

    const walletSection = wallets.primary ? (
      <section aria-labelledby="wallet-status" className="flex flex-col gap-4">
        <WalletStatus
          connected={connected}
          connecting={connectWallet.isPending}
          disconnecting={disconnectWallet.isPending}
          canConnect={provider !== null}
          locked={locked}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          connectButtonId={CONNECT_BUTTON_ID}
        />
        <WalletCards
          variant={variant}
          wallets={wallets}
          selected={walletSlot}
          disabled={locked}
          onSelect={selectWallet}
        />
      </section>
    ) : (
      <section className="flex flex-col items-start gap-3 rounded-[14px] bg-surface-card p-5">
        <h2 className="text-body-md leading-4 font-bold">Nenhuma carteira cadastrada</h2>
        <p className="text-body-sm text-text-secondary">Cadastre uma carteira para pagar.</p>
        <Link to="/carteiras" className="text-body-sm font-bold text-text-accent underline">
          Cadastrar carteira
        </Link>
      </section>
    )

    const noteField = (
      <FormTextarea
        id="checkout-note"
        label="Observação do colecionador (opcional)"
        variant={variant}
        disabled={locked}
        error={errors.note?.message}
        className={isTabletUp ? 'max-w-[350px]' : undefined}
        {...form.register('note')}
      />
    )

    const providers = wallets.primary && (
      <ProviderOptions
        variant={variant}
        selected={provider}
        disabled={locked}
        onSelect={selectProvider}
      />
    )

    // O resumo mostra sempre a cotação atual; se ela mudou, o aviso diz o quê.
    const itemsSection = (
      <CheckoutItems
        variant={variant}
        items={items}
        quote={quote}
        updating={quoteQuery.isFetching}
      />
    )

    const actionStyle = isTabletUp
      ? 'h-[45px] rounded-[8px] bg-primary text-body hover:bg-text-accent'
      : 'h-[60px] rounded-[40px] bg-[linear-gradient(135deg,var(--color-primary),rgb(210_138_76/0.8))] text-body'
    const actionClass = cn(
      'flex w-full items-center justify-center px-4 leading-4 font-bold text-ink disabled:opacity-60',
      actionStyle,
    )

    let action
    if (orderInProgress) {
      action = <OrderPending status={orderStatus} />
    } else if (orderStatus === 'declined') {
      action = (
        <PaymentDeclined
          reason={orderQuery.data?.failureReason ?? null}
          onRetry={retryAfterDecline}
        />
      )
    } else if (noResponse) {
      action = <NoResponse onRetry={retrySameAttempt} />
    } else if (quote && !quote.valid) {
      action = (
        <Link to="/carrinho" className={actionClass}>
          Ajustar no carrinho
        </Link>
      )
    } else if (quoteChanged) {
      action = (
        // key diferente do "Confirmar compra": se o React reaproveitasse o mesmo <button>,
        // ele viraria type="submit" no meio do clique e o formulário seria enviado.
        <button key="accept" type="button" onClick={acceptNewQuote} className={actionClass}>
          Revisar novo total
        </button>
      )
    } else {
      action = (
        <button
          key="confirm"
          id={CONFIRM_BUTTON_ID}
          type="submit"
          disabled={locked || !quote}
          aria-busy={locked}
          className={actionClass}
        >
          {locked ? 'Confirmando...' : 'Confirmar compra'}
        </button>
      )
    }

    const feedback = (
      <>
        {quoteChanged && <QuoteChanges changes={changes} valid={quote?.valid ?? true} />}
        <p
          role="status"
          data-testid="checkout-status"
          className="text-body-sm text-text-accent empty:sr-only"
        >
          {statusMessage}
        </p>
        <p role="alert" className="text-body-sm text-destructive empty:sr-only">
          {notice ||
            connectWallet.error?.message ||
            disconnectWallet.error?.message ||
            (quoteQuery.isError ? quoteQuery.error.message : '')}
        </p>
        {action}
      </>
    )

    content = (
      <form
        noValidate
        onSubmit={form.handleSubmit(confirmPurchase)}
        className={
          isTabletUp
            ? 'grid gap-12 lg:grid-cols-[minmax(0,763px)_405px] lg:justify-between lg:gap-8'
            : 'flex flex-col gap-4'
        }
      >
        {isTabletUp ? (
          <>
            <div className="flex min-w-0 flex-col gap-6">
              {collectorSection}
              {walletSection}
              {noteField}
            </div>
            <div className="flex min-w-0 flex-col gap-3">
              {itemsSection}
              <div className="flex flex-col gap-6">
                {providers}
                {feedback}
              </div>
            </div>
          </>
        ) : (
          <>
            {walletSection}
            {providers}
            {itemsSection}
            {collectorSection}
            {noteField}
            <div className="mt-4 flex flex-col gap-4">{feedback}</div>
          </>
        )}
      </form>
    )
  }

  if (!isTabletUp) {
    return (
      <main className="mx-auto flex w-full max-w-[414px] flex-col gap-4 px-7 pt-8 pb-12">
        <div className="flex h-11 items-start gap-6">
          <button
            type="button"
            aria-label="Voltar"
            onClick={handleBack}
            className="grid size-[35px] shrink-0 place-items-center rounded-full border border-border bg-surface-raised"
          >
            <img src="/icons/arrow-left.svg" alt="" width={20} height={20} />
          </button>
          <h1 className="pt-[9px] text-[20px] leading-4 font-bold">Pagamento com carteira</h1>
        </div>
        {content}
      </main>
    )
  }

  return (
    // Nos frames do Figma a linha do header vai até y=69 e o conteúdo começa em y=101;
    // o header do app é 9px mais baixo, então a distância aqui é 41px em vez de 32px.
    <main className="mx-auto flex w-full max-w-[1232px] flex-col gap-8 px-4 pt-[41px]">
      <h1 className="sr-only">Pagamento</h1>
      <nav aria-label="Trilha de navegação" className="text-body leading-4 font-bold">
        <Link to="/" className="hover:underline">
          Início
        </Link>{' '}
        /{' '}
        <Link to="/carrinho" className="hover:underline">
          Carrinho
        </Link>{' '}
        / <span aria-current="page">Pagamento</span>
      </nav>
      {content}
    </main>
  )
}

function CheckoutSkeleton({ variant }: { variant: 'desktop' | 'mobile' }) {
  if (variant === 'mobile') {
    return (
      <div aria-busy="true" aria-label="Carregando pagamento" className="flex flex-col gap-4">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-[93px] rounded-[14px]" />
        <Skeleton className="h-[93px] rounded-[14px]" />
        <Skeleton className="h-[65px] rounded-[15px]" />
        <Skeleton className="h-[65px] rounded-[15px]" />
        <Skeleton className="h-[65px] rounded-[15px]" />
      </div>
    )
  }
  return (
    <div
      aria-busy="true"
      aria-label="Carregando pagamento"
      className="grid gap-12 lg:grid-cols-[minmax(0,763px)_405px] lg:justify-between lg:gap-8"
    >
      <div className="flex flex-col gap-6">
        <Skeleton className="h-[200px]" />
        <Skeleton className="h-[140px]" />
        <Skeleton className="h-[179px] max-w-[350px]" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-[70px]" />
        <Skeleton className="h-[70px]" />
        <Skeleton className="h-[180px]" />
        <Skeleton className="h-[236px]" />
      </div>
    </div>
  )
}
