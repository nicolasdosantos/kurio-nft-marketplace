import { useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { useApplyCoupon, useRemoveCoupon } from '@/api/cart'
import type { Quote } from '@/api/contracts/cart'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface CartSummaryProps {
  variant: 'desktop' | 'mobile'
  couponCode: string | null
  quote: Quote | undefined
  quoteUpdating: boolean
  // Motivo para não deixar finalizar (itens com problema, alteração em andamento).
  blockedReason: string | null
  onStatus: (message: string) => void
}

const variants = {
  desktop: {
    input:
      'flex h-10 items-stretch overflow-hidden rounded-[3px] border border-primary focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-text-accent',
    field:
      'min-w-0 flex-1 bg-transparent pl-2 text-caption-sm leading-4 text-foreground placeholder:text-secondary outline-none',
    apply:
      'w-[102px] shrink-0 rounded-r-[3px] bg-primary text-body leading-4 font-bold text-ink hover:bg-text-accent disabled:opacity-50',
    value: 'text-body-lg leading-4',
    checkout:
      'flex h-10 w-full items-center justify-center rounded-[3px] bg-primary text-body leading-4 font-bold text-ink hover:bg-text-accent',
  },
  mobile: {
    input:
      'flex h-[50px] items-stretch overflow-hidden rounded-[40px] border border-field-border bg-surface-card shadow-[0_6px_20px_rgb(10_6_4/0.45)] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-text-accent',
    field:
      'min-w-0 flex-1 bg-transparent pl-4 text-caption leading-[22px] text-foreground placeholder:text-secondary outline-none',
    apply:
      'w-[97px] shrink-0 rounded-[40px] bg-[linear-gradient(135deg,rgb(210_138_76/0.54),var(--color-primary))] text-body leading-4 font-bold text-foreground disabled:opacity-50',
    value: 'text-body-md leading-4',
    checkout:
      'flex h-[60px] w-full items-center justify-center rounded-[40px] bg-[linear-gradient(135deg,var(--color-primary),rgb(210_138_76/0.8))] text-body-md leading-4 font-bold text-ink',
  },
}

export function CartSummary({
  variant,
  couponCode,
  quote,
  quoteUpdating,
  blockedReason,
  onStatus,
}: CartSummaryProps) {
  const style = variants[variant]
  const applyCoupon = useApplyCoupon()
  const removeCoupon = useRemoveCoupon()
  const [code, setCode] = useState('')
  const inputId = `coupon-${variant}`
  const errorId = `coupon-error-${variant}`
  const couponError = applyCoupon.isError
    ? (applyCoupon.error.fields.code ?? applyCoupon.error.message)
    : ''

  function handleApply(event: FormEvent) {
    event.preventDefault()
    const trimmed = code.trim()
    if (!trimmed) return
    applyCoupon.mutate(trimmed, {
      onSuccess: () => {
        setCode('')
        onStatus(`Cupom ${trimmed.toUpperCase()} aplicado.`)
      },
    })
  }

  function handleRemove() {
    removeCoupon.mutate(undefined, { onSuccess: () => onStatus('Cupom removido.') })
  }

  const rows = quote
    ? [
        { label: 'Subtotal', value: `${quote.subtotalEth} ETH` },
        {
          label: quote.coupon ? `Desconto do cupom (${quote.coupon.percentOff}%)` : 'Desconto',
          value: `(-) ${quote.discountEth} ETH`,
        },
      ]
    : []

  return (
    <div className="flex flex-col gap-3">
      {couponCode ? (
        <p className="flex min-h-10 flex-wrap items-center justify-between gap-2 text-body-sm text-foreground">
          <span>
            Cupom <strong className="text-text-accent">{couponCode}</strong> aplicado
          </span>
          <button
            type="button"
            onClick={handleRemove}
            disabled={removeCoupon.isPending}
            className="text-text-accent underline underline-offset-4 disabled:opacity-50"
          >
            {removeCoupon.isPending ? 'Removendo...' : 'Remover cupom'}
          </button>
        </p>
      ) : (
        <form onSubmit={handleApply} noValidate className="flex flex-col gap-2">
          <label
            htmlFor={inputId}
            className={cn(
              'text-body-sm leading-4 font-bold text-foreground',
              variant === 'mobile' && 'sr-only',
            )}
          >
            Código promocional
          </label>
          <div className={style.input}>
            <input
              id={inputId}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Digite o código promocional..."
              autoComplete="off"
              aria-invalid={couponError ? true : undefined}
              aria-describedby={couponError ? errorId : undefined}
              className={style.field}
            />
            <button type="submit" disabled={applyCoupon.isPending} className={style.apply}>
              {applyCoupon.isPending ? '...' : 'Aplicar'}
            </button>
          </div>
          {couponError && (
            <p id={errorId} role="alert" className="text-body-sm text-destructive">
              {couponError}
            </p>
          )}
        </form>
      )}

      <dl
        data-testid="cart-summary"
        aria-busy={quoteUpdating}
        className={cn(
          'mt-3 flex flex-col gap-3 text-body leading-5 text-foreground',
          quoteUpdating && 'opacity-60',
        )}
      >
        {quote ? (
          <>
            {rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4">
                <dt>{row.label}</dt>
                <dd className={style.value}>{row.value}</dd>
              </div>
            ))}
            {/* A "Taxa estimada" fica dentro do dd: num <dl> só cabem dt e dd. */}
            <div className="flex items-start justify-between gap-4">
              <dt>Taxa de rede</dt>
              <dd className="flex flex-col items-end gap-3">
                <span className={cn(style.value, 'leading-5')}>{quote.networkFeeEth} ETH</span>
                <span className="text-caption-sm leading-4 text-text-accent">
                  Taxa estimada (Ethereum)
                </span>
              </dd>
            </div>
            <div className="mt-3 flex items-center justify-between gap-4">
              <dt className="text-body-md leading-4 font-bold">Total</dt>
              <dd
                data-testid="cart-total"
                className="text-body-lg leading-4 font-bold text-text-accent"
              >
                {quote.totalEth} ETH
              </dd>
            </div>
          </>
        ) : (
          // Mesmas alturas das linhas prontas, para o resumo não pular.
          <>
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
            <Skeleton className="h-9" />
            <Skeleton className="mt-3 h-4" />
          </>
        )}
      </dl>

      <div className={cn('flex flex-col gap-3', variant === 'mobile' ? 'mt-5' : 'mt-3')}>
        {blockedReason ? (
          <>
            <button type="button" disabled className={cn(style.checkout, 'opacity-50')}>
              Conectar e finalizar
            </button>
            <p className="text-center text-body-sm text-text-secondary">{blockedReason}</p>
          </>
        ) : (
          // O visitante passa pelo login (requireLogin da rota) e depois segue para o pagamento.
          <Link to="/pagamento" className={style.checkout}>
            Conectar e finalizar
          </Link>
        )}
        {variant === 'desktop' && (
          <Link to="/" className="text-center text-body leading-5 text-text-accent hover:underline">
            Continuar explorando
          </Link>
        )}
      </div>
    </div>
  )
}
