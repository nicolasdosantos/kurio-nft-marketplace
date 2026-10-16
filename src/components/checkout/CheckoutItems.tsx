import { Link } from '@tanstack/react-router'
import type { CartItem, Quote } from '@/api/contracts/cart'
import { Skeleton } from '@/components/ui/skeleton'
import { networkLabels, nftImageSources } from '@/lib/display'
import { cn } from '@/lib/utils'

interface CheckoutItemsProps {
  variant: 'desktop' | 'mobile'
  items: CartItem[]
  quote: Quote | undefined
  updating: boolean
}

// Itens e valores sempre da cotação da API; o carrinho só dá nome, imagem e edição.
export function CheckoutItems({ variant, items, quote, updating }: CheckoutItemsProps) {
  const isDesktop = variant === 'desktop'

  return (
    <section aria-labelledby="checkout-items-title" className="flex flex-col gap-3">
      <h2
        id="checkout-items-title"
        className={cn('font-bold', isDesktop ? 'text-[17px] leading-4' : 'text-body-md leading-4')}
      >
        Seus NFTs
      </h2>
      <div aria-hidden="true" className="flex flex-col gap-3">
        <div className="flex justify-between text-body-md leading-4">
          <span className="font-bold">NFTs</span>
          <span className="font-medium">Subtotal</span>
        </div>
        <div className="h-px bg-primary/30" />
      </div>

      {quote ? (
        <ul
          aria-label="Itens do pedido"
          data-testid="checkout-items"
          className="flex flex-col gap-3"
        >
          {quote.lines.map((line) => {
            const cartItem = items.find((item) => item.id === line.itemId)
            if (!cartItem) return null
            const image = nftImageSources(cartItem.imageUrl)
            const outOfStock = line.issues.includes('OUT_OF_STOCK')
            const exceedsStock = line.issues.includes('QUANTITY_EXCEEDS_STOCK')
            return (
              <li
                key={line.itemId}
                className="flex min-h-[70px] items-center gap-2 bg-surface-card pr-4 pl-1"
              >
                <img
                  src={image.src}
                  alt=""
                  width={70}
                  height={70}
                  className="size-[62px] shrink-0 rounded-[8px] object-cover sm:size-[70px]"
                />
                <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-2 gap-y-1.5 py-2">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-body-md leading-4 font-bold text-foreground">
                      {cartItem.name}
                    </span>
                    <span className="text-body-sm leading-4 text-secondary">
                      Edição {cartItem.editionLabel}
                    </span>
                    {outOfStock && (
                      <span className="text-caption leading-4 text-destructive">Esgotado</span>
                    )}
                    {exceedsStock && (
                      <span className="text-caption leading-4 text-destructive">
                        Estoque menor que a quantidade
                      </span>
                    )}
                  </div>
                  <div className="ml-auto flex items-center gap-1.5 whitespace-nowrap">
                    <span className="text-body-sm leading-4 text-text-secondary">
                      (x {line.quantity})
                    </span>
                    <span className="text-body-lg leading-4 font-bold text-text-accent">
                      {line.lineTotalEth} ETH
                    </span>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-[70px]" />
          <Skeleton className="h-[70px]" />
        </div>
      )}

      <p className="text-body-sm leading-4 text-foreground">
        {quote?.coupon ? (
          <>
            Cupom <strong className="text-text-accent">{quote.coupon.code}</strong> aplicado.
          </>
        ) : (
          <>
            Tem um código promocional?{' '}
            <Link to="/carrinho" className="text-text-accent underline underline-offset-4">
              Aplique aqui
            </Link>
          </>
        )}
      </p>

      <dl
        data-testid="checkout-summary"
        aria-busy={updating}
        className={cn('flex flex-col gap-3 text-body leading-5', updating && 'opacity-60')}
      >
        {quote ? (
          <>
            <div className="flex items-center justify-between gap-4">
              <dt>Subtotal</dt>
              <dd className="text-body-lg leading-4">{quote.subtotalEth} ETH</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt>
                {quote.coupon ? `Desconto do cupom (${quote.coupon.percentOff}%)` : 'Desconto'}
              </dt>
              <dd>(-) {quote.discountEth} ETH</dd>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <dt>Taxa de rede</dt>
                <dd data-testid="checkout-fee" className="text-body-lg leading-4">
                  {quote.networkFeeEth} ETH
                </dd>
              </div>
              <span className="text-caption-sm leading-4 text-text-accent">
                Taxa estimada ({networkLabels[quote.network]})
              </span>
            </div>
            <div className="h-px bg-primary/30" />
            {/* Desktop: linha com recuo de 42px; mobile: "Total:" à direita, como no Figma. */}
            <div
              className={cn(
                'flex items-center gap-4',
                isDesktop ? 'justify-between lg:px-[42px]' : 'justify-end gap-7',
              )}
            >
              <dt className="text-body-md leading-4 font-bold">{isDesktop ? 'Total' : 'Total:'}</dt>
              <dd
                data-testid="checkout-total"
                className="text-body-lg leading-4 font-bold text-text-accent"
              >
                {quote.totalEth} ETH
              </dd>
            </div>
          </>
        ) : (
          <>
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
            <Skeleton className="h-12" />
            <Skeleton className="h-4" />
          </>
        )}
      </dl>
    </section>
  )
}
