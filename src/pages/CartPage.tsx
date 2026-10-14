import { useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import {
  useApplyCoupon,
  useCart,
  useQuote,
  useRemoveCartItem,
  useRemoveCoupon,
  useUpdateCartItem,
} from '@/api/cart'

export function CartPage() {
  const cartQuery = useCart()
  const hasItems = (cartQuery.data?.items.length ?? 0) > 0
  // O resumo do carrinho usa Ethereum, a rede do layout; no pagamento o usuário escolhe.
  const quoteQuery = useQuote('ethereum', hasItems)
  const updateItem = useUpdateCartItem()
  const removeItem = useRemoveCartItem()
  const applyCoupon = useApplyCoupon()
  const removeCoupon = useRemoveCoupon()
  const [couponCode, setCouponCode] = useState('')

  function handleCouponSubmit(event: FormEvent) {
    event.preventDefault()
    if (couponCode.trim()) applyCoupon.mutate(couponCode.trim())
  }

  if (cartQuery.isPending) return <main className="p-4">Carregando carrinho...</main>
  if (cartQuery.isError) {
    return (
      <main className="p-4" role="alert">
        {cartQuery.error.message}{' '}
        <button type="button" className="underline" onClick={() => cartQuery.refetch()}>
          Tentar de novo
        </button>
      </main>
    )
  }

  const cart = cartQuery.data
  const quote = quoteQuery.data
  const itemError = updateItem.error ?? removeItem.error

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <h1 className="text-heading font-bold">Carrinho</h1>

      {!hasItems && (
        <p>
          Seu carrinho está vazio.{' '}
          <Link to="/" className="underline">
            Explorar o mercado
          </Link>
        </p>
      )}

      {hasItems && (
        <ul data-testid="cart-items" className="flex flex-col gap-2">
          {cart.items.map((cartItem) => {
            return (
              <li key={cartItem.id} className="rounded border border-border bg-surface-card p-2">
                <Link to="/nft/$nftId" params={{ nftId: cartItem.nftId }} className="font-bold">
                  {cartItem.name}
                </Link>{' '}
                · {cartItem.editionLabel} · {cartItem.unitPriceEth} ETH
                {cartItem.unitPriceEth !== cartItem.addedPriceEth && (
                  <span className="ml-2 text-text-accent">
                    (era {cartItem.addedPriceEth} ETH quando você adicionou)
                  </span>
                )}
                {cartItem.quantity > cartItem.stock && (
                  <p className="text-destructive">Só restam {cartItem.stock} unidades.</p>
                )}
                <div className="mt-1 flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={`Diminuir quantidade de ${cartItem.name}`}
                    disabled={cartItem.quantity <= 1 || updateItem.isPending}
                    onClick={() =>
                      updateItem.mutate({ itemId: cartItem.id, quantity: cartItem.quantity - 1 })
                    }
                    className="rounded border px-2"
                  >
                    −
                  </button>
                  <span>{cartItem.quantity}</span>
                  <button
                    type="button"
                    aria-label={`Aumentar quantidade de ${cartItem.name}`}
                    disabled={cartItem.quantity >= cartItem.stock || updateItem.isPending}
                    onClick={() =>
                      updateItem.mutate({ itemId: cartItem.id, quantity: cartItem.quantity + 1 })
                    }
                    className="rounded border px-2"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem.mutate(cartItem.id)}
                    className="ml-auto underline"
                  >
                    Remover {cartItem.name}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {itemError && (
        <p role="alert" className="text-destructive">
          {itemError.message}
        </p>
      )}

      {hasItems && (
        <section aria-label="Resumo do carrinho" className="flex flex-col gap-2">
          {cart.couponCode ? (
            <p>
              Cupom aplicado: <strong>{cart.couponCode}</strong>{' '}
              <button type="button" className="underline" onClick={() => removeCoupon.mutate()}>
                Remover cupom
              </button>
            </p>
          ) : (
            <form onSubmit={handleCouponSubmit} className="flex gap-2">
              <label htmlFor="coupon-code">Código promocional</label>
              <input
                id="coupon-code"
                value={couponCode}
                onChange={(event) => setCouponCode(event.target.value)}
                aria-invalid={applyCoupon.isError}
                aria-describedby={applyCoupon.isError ? 'coupon-error' : undefined}
                className="rounded border border-input bg-ink p-1"
              />
              <button type="submit" className="rounded bg-primary px-2 text-primary-foreground">
                Aplicar
              </button>
            </form>
          )}
          {applyCoupon.isError && (
            <p id="coupon-error" className="text-destructive">
              {applyCoupon.error.fields.code ?? applyCoupon.error.message}
            </p>
          )}

          {quoteQuery.isPending && <p>Calculando total...</p>}
          {quoteQuery.isError && <p role="alert">{quoteQuery.error.message}</p>}
          {quote && (
            <dl data-testid="cart-summary" className="grid grid-cols-2 gap-1">
              <dt>Subtotal</dt>
              <dd>{quote.subtotalEth} ETH</dd>
              <dt>Desconto</dt>
              <dd>(-) {quote.discountEth} ETH</dd>
              <dt>Taxa de rede</dt>
              <dd>{quote.networkFeeEth} ETH</dd>
              <dt className="font-bold">Total</dt>
              <dd className="font-bold" data-testid="cart-total">
                {quote.totalEth} ETH
              </dd>
            </dl>
          )}

          <Link
            to="/pagamento"
            className="rounded bg-primary p-2 text-center text-primary-foreground"
          >
            Conectar e finalizar
          </Link>
        </section>
      )}
    </main>
  )
}
