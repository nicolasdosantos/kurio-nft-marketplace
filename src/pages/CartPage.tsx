import { useState, type ReactNode, type CSSProperties } from 'react'
import { Link, useCanGoBack, useNavigate, useRouter } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import { useCart, useQuote, useRemoveCartItem, useUpdateCartItem } from '@/api/cart'
import { useNftList } from '@/api/catalog'
import type { CartItem, QuoteIssue } from '@/api/contracts/cart'
import { CartSummary } from '@/components/cart/CartSummary'
import { NftCarousel } from '@/components/nft/NftCarousel'
import { QuantityStepper } from '@/components/nft/QuantityStepper'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { nftImageSources } from '@/lib/display'
import { useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'

interface LineState {
  cartItem: CartItem
  issues: QuoteIssue[]
  lineTotalEth: string | undefined
  maxQuantity: number
}

export function CartPage() {
  const cartQuery = useCart()
  const items = cartQuery.data?.items ?? []
  const hasItems = items.length > 0
  // O resumo usa Ethereum, a rede do layout; no pagamento o usuário escolhe a carteira e a rede.
  const quoteQuery = useQuote('ethereum', hasItems)
  const updateItem = useUpdateCartItem()
  const removeItem = useRemoveCartItem()
  const isTabletUp = useMediaQuery('(min-width: 768px)')
  const navigate = useNavigate()
  const router = useRouter()
  const canGoBack = useCanGoBack()
  const [status, setStatus] = useState('')

  const quote = quoteQuery.data
  // Uma alteração por vez: enquanto uma está em andamento, nada mais pode ser clicado.
  const busy = updateItem.isPending || removeItem.isPending
  const itemError = updateItem.error ?? removeItem.error

  const lines: LineState[] = items.map((cartItem) => {
    const quoteLine = quote?.lines.find((line) => line.itemId === cartItem.id)
    return {
      cartItem,
      issues: quoteLine?.issues ?? [],
      lineTotalEth: quoteLine?.lineTotalEth,
      maxQuantity: Math.min(cartItem.stock, cartItem.maxPerOrder),
    }
  })
  const hasIssues = lines.some((line) => line.issues.length > 0)
  const blockedReason = hasIssues
    ? 'Resolva os avisos dos itens para finalizar.'
    : busy || !quote || quoteQuery.isFetching
      ? 'Atualizando o resumo...'
      : !quote.valid
        ? 'Não foi possível validar o carrinho.'
        : null

  function changeQuantity(cartItem: CartItem, quantity: number, message: string) {
    setStatus('')
    updateItem.mutate({ itemId: cartItem.id, quantity }, { onSuccess: () => setStatus(message) })
  }

  function remove(cartItem: CartItem) {
    setStatus('')
    removeItem.mutate(cartItem.id, {
      onSuccess: () => setStatus(`${cartItem.name} saiu do carrinho.`),
    })
  }

  function handleBack() {
    if (canGoBack) router.history.back()
    else navigate({ to: '/' })
  }

  const lineActions = {
    busy,
    onQuantity: (cartItem: CartItem, quantity: number) =>
      changeQuantity(
        cartItem,
        quantity,
        `Quantidade de ${cartItem.name} atualizada para ${quantity}.`,
      ),
    onAcceptPrice: (cartItem: CartItem) =>
      changeQuantity(cartItem, cartItem.quantity, `Novo preço de ${cartItem.name} aceito.`),
    onFitStock: (cartItem: CartItem) =>
      changeQuantity(
        cartItem,
        cartItem.stock,
        `Quantidade de ${cartItem.name} ajustada para ${cartItem.stock}.`,
      ),
    onRemove: remove,
  }

  const feedback = (
    <>
      <p
        role="status"
        data-testid="cart-status"
        className="text-body-sm text-text-accent empty:sr-only"
      >
        {status}
      </p>
      <p role="alert" className="text-body-sm text-destructive empty:sr-only">
        {itemError?.message}
      </p>
    </>
  )

  let content
  if (cartQuery.isPending) {
    content = <CartSkeleton isTabletUp={isTabletUp} />
  } else if (cartQuery.isError) {
    content = (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-lg bg-surface-card p-6">
        <p className="text-body-md font-bold text-foreground">
          Não foi possível carregar o carrinho.
        </p>
        <p className="text-body-sm text-text-secondary">{cartQuery.error.message}</p>
        <Button onClick={() => cartQuery.refetch()}>Tentar de novo</Button>
      </div>
    )
  } else if (!hasItems) {
    content = (
      <div className="flex flex-col items-center gap-4 rounded-lg bg-surface-card px-6 py-12 text-center">
        <p className="text-body-md font-bold text-foreground">Seu carrinho está vazio.</p>
        <p className="text-body-sm text-text-secondary">
          Escolha um NFT no catálogo e ele aparece aqui.
        </p>
        <Link
          to="/"
          className="flex h-10 items-center rounded-[6px] bg-primary px-5 text-body-sm font-bold text-ink hover:bg-text-accent"
        >
          Explorar o mercado
        </Link>
        {feedback}
      </div>
    )
  } else if (!isTabletUp) {
    content = (
      <>
        <ul
          aria-label="Itens do carrinho"
          data-testid="cart-items"
          className="rise-in flex flex-col gap-5 px-7"
        >
          {lines.map((line, index) => (
            <MobileCartLine key={line.cartItem.id} index={index} line={line} {...lineActions} />
          ))}
        </ul>
        <div className="px-7">{feedback}</div>
        <section
          aria-label="Resumo do pedido"
          className="rise-in -mt-2 rounded-t-[40px] bg-surface-card px-6 pt-6 pb-9"
        >
          <CartSummary
            variant="mobile"
            couponCode={cartQuery.data.couponCode}
            quote={quote}
            quoteUpdating={quoteQuery.isFetching}
            blockedReason={blockedReason}
            onStatus={setStatus}
          />
        </section>
      </>
    )
  } else {
    content = (
      <div className="rise-in flex flex-col gap-12 lg:flex-row lg:items-start lg:gap-[86px]">
        <div className="min-w-0 flex-1 lg:max-w-[782px]">
          <table
            data-testid="cart-items"
            // O espaço de 12px entre as linhas é uma borda transparente nas células: com
            // border-spacing o Chrome somava 24px entre o cabeçalho e o primeiro item.
            className="w-full border-separate border-spacing-0 [&_tbody_td]:border-t-12 [&_tbody_td]:border-transparent [&_tbody_td]:bg-clip-padding"
          >
            <caption className="sr-only">Itens do carrinho</caption>
            <thead>
              <tr className="text-left text-body-md leading-4 text-foreground">
                <th scope="col" className="border-b border-primary/30 pb-3 font-bold lg:w-[311px]">
                  NFTs
                </th>
                <th
                  scope="col"
                  className="border-b border-primary/30 pb-3 font-medium lg:w-[139px]"
                >
                  Preço
                </th>
                <th scope="col" className="border-b border-primary/30 pb-3 font-bold lg:w-[136px]">
                  Quantidade
                </th>
                <th
                  scope="col"
                  className="border-b border-primary/30 pb-3 font-medium lg:w-[148px]"
                >
                  Total
                </th>
                <th scope="col" className="border-b border-primary/30 pb-3">
                  <span className="sr-only">Remover</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <DesktopCartLine
                  key={line.cartItem.id}
                  index={index}
                  line={line}
                  {...lineActions}
                />
              ))}
            </tbody>
          </table>
          {feedback}
        </div>

        <section
          aria-labelledby="summary-title"
          className="flex flex-col gap-6 lg:w-[332px] lg:shrink-0"
        >
          <div className="flex flex-col gap-3">
            <h2 id="summary-title" className="text-body-lg leading-4 font-bold text-foreground">
              Resumo do pedido
            </h2>
            <div className="h-px bg-primary/30" />
          </div>
          <CartSummary
            variant="desktop"
            couponCode={cartQuery.data.couponCode}
            quote={quote}
            quoteUpdating={quoteQuery.isFetching}
            blockedReason={blockedReason}
            onStatus={setStatus}
          />
        </section>
      </div>
    )
  }

  if (!isTabletUp) {
    return (
      <main className="flex flex-col gap-3 pt-8">
        <div className="relative flex h-11 items-start justify-center px-7">
          <button
            type="button"
            aria-label="Voltar"
            onClick={handleBack}
            className="absolute left-7 grid size-[35px] place-items-center rounded-full border border-border bg-surface-raised"
          >
            <img src="/icons/arrow-left.svg" alt="" width={20} height={20} />
          </button>
          <h1 className="pt-[9px] text-[20px] leading-4 font-bold text-foreground">
            Carrinho de NFTs
          </h1>
        </div>
        {/* Altura de um carrinho com 3 itens: skeleton, vazio e carrinho pequeno ocupam o
            mesmo espaço e o carrossel de baixo não pula (CLS). */}
        <div
          data-testid="cart-content"
          className="flex min-h-[716px] flex-col gap-3 md:min-h-[712px] lg:min-h-[365px]"
        >
          {content}
        </div>
        <div className="mt-24 px-6">
          <AlsoViewed cartItems={items} />
        </div>
      </main>
    )
  }

  return (
    // 41px: compensa o header do app, mais baixo que o dos frames (como no Pagamento).
    <main className="mx-auto flex w-full max-w-[1232px] flex-col gap-24 px-4 pt-[41px]">
      <div className="flex flex-col gap-3">
        <h1 className="sr-only">Carrinho de NFTs</h1>
        <nav aria-label="Trilha de navegação" className="text-body leading-4 font-bold">
          <Link to="/" className="hover:underline">
            Início
          </Link>{' '}
          / <span aria-current="page">Carrinho</span>
        </nav>
        {/* Altura de um carrinho com 3 itens: skeleton, vazio e carrinho pequeno ocupam o
            mesmo espaço e o carrossel de baixo não pula (CLS). */}
        <div
          data-testid="cart-content"
          className="flex min-h-[716px] flex-col gap-3 md:min-h-[712px] lg:min-h-[365px]"
        >
          {content}
        </div>
      </div>
      <AlsoViewed cartItems={items} />
    </main>
  )
}

function AlsoViewed({ cartItems }: { cartItems: CartItem[] }) {
  const listQuery = useNftList({ tab: 'trending', pageSize: 12 })
  const inCart = new Set(cartItems.map((cartItem) => cartItem.nftId))
  const suggestions = listQuery.data?.items.filter((nft) => !inCart.has(nft.id)) ?? []
  return (
    <NftCarousel
      title="Colecionadores também viram"
      items={suggestions}
      isPending={listQuery.isPending}
    />
  )
}

interface LineProps {
  line: LineState
  // Posição na lista, para os itens entrarem um de cada vez.
  index?: number
  busy: boolean
  onQuantity: (cartItem: CartItem, quantity: number) => void
  onAcceptPrice: (cartItem: CartItem) => void
  onFitStock: (cartItem: CartItem) => void
  onRemove: (cartItem: CartItem) => void
}

// O que mudou no item desde que ele entrou no carrinho, com o jeito de resolver.
function LineIssues({ line, busy, onAcceptPrice, onFitStock }: LineProps) {
  const { cartItem, issues } = line
  if (issues.length === 0) return null

  return (
    <ul className="flex flex-col gap-1 text-caption leading-4" data-testid="line-issues">
      {issues.includes('PRICE_CHANGED') && (
        <li className="flex flex-wrap items-center gap-2 text-text-accent">
          O preço mudou de {cartItem.addedPriceEth} para {cartItem.unitPriceEth} ETH.
          <button
            type="button"
            disabled={busy}
            onClick={() => onAcceptPrice(cartItem)}
            className="font-bold underline underline-offset-4 disabled:opacity-50"
          >
            Aceitar novo preço
          </button>
        </li>
      )}
      {issues.includes('QUANTITY_EXCEEDS_STOCK') && (
        <li className="flex flex-wrap items-center gap-2 text-destructive">
          Só restam {cartItem.stock}.
          <button
            type="button"
            disabled={busy}
            onClick={() => onFitStock(cartItem)}
            className="font-bold underline underline-offset-4 disabled:opacity-50"
          >
            Ajustar para {cartItem.stock}
          </button>
        </li>
      )}
      {issues.includes('OUT_OF_STOCK') && (
        <li className="text-destructive">Esgotado. Remova o item para continuar.</li>
      )}
    </ul>
  )
}

function RemoveButton({ line, busy, onRemove, className }: LineProps & { className?: string }) {
  return (
    <button
      type="button"
      aria-label={`Remover ${line.cartItem.name}, edição ${line.cartItem.editionLabel}`}
      disabled={busy}
      onClick={() => onRemove(line.cartItem)}
      className={cn('grid size-6 place-items-center text-secondary disabled:opacity-40', className)}
    >
      {/* Provisório: o SVG do Figma (Iconly/Curved/Delete) não pôde ser exportado ainda. */}
      <Trash2 aria-hidden="true" className="size-6" strokeWidth={1.5} />
    </button>
  )
}

function DesktopCartLine(props: LineProps) {
  const { line, busy, onQuantity } = props
  const { cartItem } = line
  const image = nftImageSources(cartItem.imageUrl)

  return (
    <tr
      style={{ '--stagger': props.index ?? 0 } as CSSProperties}
      className="rise-in text-body-md leading-4 font-bold"
    >
      <td className="bg-surface-card p-0 align-middle">
        <div className="flex items-center gap-4">
          <img
            src={image.src}
            alt=""
            width={70}
            height={70}
            className="size-[70px] shrink-0 rounded-[6px] object-cover"
          />
          <div className="flex min-w-0 flex-col gap-1.5 py-2">
            <Link
              to="/nft/$nftId"
              params={{ nftId: cartItem.nftId }}
              className="text-foreground hover:underline"
            >
              {cartItem.name}
            </Link>
            <span className="text-body-sm leading-4 font-normal text-secondary">
              Edição {cartItem.editionLabel} · {cartItem.tokenId}
            </span>
            <LineIssues {...props} />
          </div>
        </div>
      </td>
      <td className="bg-surface-card align-middle text-text-secondary">
        {cartItem.unitPriceEth} ETH
      </td>
      <td className="bg-surface-card align-middle">
        <QuantityStepper
          size="small"
          label={`Quantidade de ${cartItem.name}`}
          value={cartItem.quantity}
          max={line.maxQuantity}
          onChange={(quantity) => onQuantity(cartItem, quantity)}
          disabled={busy}
        />
      </td>
      <td className="bg-surface-card align-middle text-text-accent" data-testid="line-total">
        {line.lineTotalEth ? `${line.lineTotalEth} ETH` : <Skeleton className="h-4 w-20" />}
      </td>
      <td className="bg-surface-card pr-6 text-right align-middle">
        <RemoveButton {...props} />
      </td>
    </tr>
  )
}

function MobileStepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="group grid size-6 place-items-center rounded-full border border-border bg-surface-raised text-foreground disabled:cursor-not-allowed"
    >
      {children}
    </button>
  )
}

function MobileCartLine(props: LineProps) {
  const { line, busy, onQuantity } = props
  const { cartItem } = line
  const image = nftImageSources(cartItem.imageUrl)
  const canDecrease = !busy && cartItem.quantity > 1
  const canIncrease = !busy && cartItem.quantity < line.maxQuantity

  return (
    <li
      style={{ '--stagger': props.index ?? 0 } as CSSProperties}
      className="rise-in relative flex min-h-[100px] rounded-[14px] bg-surface-card shadow-[0_6px_20px_rgb(10_6_4/0.45)]"
    >
      <img
        src={image.src}
        alt=""
        width={100}
        height={100}
        className="size-[100px] shrink-0 rounded-[14px] object-cover"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-[13px] pr-4 pl-[9px]">
        <Link
          to="/nft/$nftId"
          params={{ nftId: cartItem.nftId }}
          className="pr-6 text-body leading-4 font-bold text-foreground"
        >
          {cartItem.name}
        </Link>
        <span className="text-body-sm leading-4 text-text-secondary">
          Edição: {cartItem.editionLabel}
        </span>
        <LineIssues {...props} />
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <span
            className="text-body-lg leading-4 font-bold text-text-accent"
            data-testid="line-total"
          >
            {line.lineTotalEth ? `${line.lineTotalEth} ETH` : <Skeleton className="h-4 w-20" />}
          </span>
          <div
            role="group"
            aria-label={`Quantidade de ${cartItem.name}`}
            className="flex items-center gap-3"
          >
            <MobileStepButton
              label="Diminuir quantidade"
              disabled={!canDecrease}
              onClick={() => onQuantity(cartItem, cartItem.quantity - 1)}
            >
              <span className="h-0.5 w-[9px] bg-foreground group-disabled:bg-border-soft" />
            </MobileStepButton>
            <span
              data-testid="quantity"
              className="min-w-[1ch] text-center text-body-md leading-[22px] text-foreground"
            >
              {cartItem.quantity}
            </span>
            <MobileStepButton
              label="Aumentar quantidade"
              disabled={!canIncrease}
              onClick={() => onQuantity(cartItem, cartItem.quantity + 1)}
            >
              <span
                aria-hidden="true"
                className="text-[21px] leading-4 group-disabled:text-border-soft"
              >
                +
              </span>
            </MobileStepButton>
          </div>
        </div>
      </div>
      <RemoveButton {...props} className="absolute top-2 right-2" />
    </li>
  )
}

function CartSkeleton({ isTabletUp }: { isTabletUp: boolean }) {
  if (!isTabletUp) {
    return (
      <div aria-hidden="true" data-testid="cart-skeleton" className="flex flex-col gap-5 px-7">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-[100px] rounded-[14px]" />
        ))}
      </div>
    )
  }
  return (
    <div
      aria-hidden="true"
      data-testid="cart-skeleton"
      className="flex flex-col gap-12 lg:flex-row lg:gap-[86px]"
    >
      <div className="flex flex-1 flex-col gap-3 lg:max-w-[782px]">
        <Skeleton className="h-7" />
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-[70px]" />
        ))}
      </div>
      <Skeleton className="h-[365px] lg:w-[332px]" />
    </div>
  )
}
