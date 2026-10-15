import { cn } from '@/lib/utils'

// Tamanhos do Figma: botões 33×50 no desktop e 20×30 na barra de compra do mobile.
const sizes = {
  large: {
    button: 'h-[50px] w-[33px] rounded-[33px] shadow-[0_6.6px_19.8px_-3.3px_rgb(20_13_10/0.15)]',
    icon: 26,
    value: 'text-[20px] leading-7',
  },
  small: {
    button: 'h-[30px] w-5 rounded-[20px] shadow-[0_4px_12px_-2px_rgb(20_13_10/0.15)]',
    icon: 16,
    value: 'text-body-lg leading-[25px] font-medium',
  },
}

interface QuantityStepperProps {
  value: number
  max: number
  onChange: (quantity: number) => void
  size: keyof typeof sizes
  // Enquanto uma alteração está em andamento, nenhum dos dois botões responde.
  disabled?: boolean
  // Nome do grupo para o leitor de tela (no carrinho, "Quantidade de <NFT>").
  label?: string
}

export function QuantityStepper({
  value,
  max,
  onChange,
  size,
  disabled = false,
  label = 'Quantidade',
}: QuantityStepperProps) {
  const style = sizes[size]
  const buttonClasses = cn(
    'grid shrink-0 place-items-center border border-ink bg-primary hover:bg-text-accent disabled:cursor-not-allowed disabled:opacity-40',
    style.button,
  )

  return (
    <div role="group" aria-label={label} className="flex items-center gap-3">
      <button
        type="button"
        aria-label="Diminuir quantidade"
        disabled={disabled || value <= 1}
        onClick={() => onChange(value - 1)}
        className={buttonClasses}
      >
        <img src="/icons/stepper-minus.svg" alt="" width={style.icon} height={style.icon} />
      </button>
      <span
        data-testid="quantity"
        aria-live="polite"
        className={cn('min-w-[1ch] text-center text-foreground tabular-nums', style.value)}
      >
        {value}
      </span>
      <button
        type="button"
        aria-label="Aumentar quantidade"
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
        className={buttonClasses}
      >
        <img src="/icons/stepper-plus.svg" alt="" width={style.icon} height={style.icon} />
      </button>
    </div>
  )
}
