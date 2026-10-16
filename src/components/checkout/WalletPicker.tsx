import { Link } from '@tanstack/react-router'
import { EllipsisVertical, Wallet as WalletIcon } from 'lucide-react'
import type { Wallet, WalletSlot, WalletsResponse, WalletType } from '@/api/contracts/account'
import type { Network } from '@/api/contracts/common'
import { shortHex, walletSlotLabels, walletTypeLabels } from '@/lib/display'
import { cn } from '@/lib/utils'

type Variant = 'desktop' | 'mobile'

// Como no Figma: a rede principal do Ethereum é a "mainnet".
const networkDescriptions: Record<Network, string> = {
  ethereum: 'Rede principal Ethereum',
  polygon: 'Rede Polygon',
  solana: 'Rede Solana',
}

// Círculo do rádio do Figma; o input de verdade fica escondido logo antes.
function RadioMark({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-4 shrink-0 place-items-center rounded-full border-[1.2px]',
        checked ? 'border-primary' : 'border-border-soft',
        className,
      )}
    >
      {checked && <span className="size-2 rounded-full bg-primary" />}
    </span>
  )
}

const radioFocus =
  'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-text-accent'

interface WalletStatusProps {
  connected: boolean
  connecting: boolean
  disconnecting: boolean
  canConnect: boolean
  locked: boolean
  onConnect: () => void
  onDisconnect: () => void
  connectButtonId: string
}

export function WalletStatus({
  connected,
  connecting,
  disconnecting,
  canConnect,
  locked,
  onConnect,
  onDisconnect,
  connectButtonId,
}: WalletStatusProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 data-testid="wallet-status" className="text-body-md leading-4 font-bold">
        {connected ? 'Carteira conectada' : 'Carteira desconectada'}
      </h2>
      {connected ? (
        <button
          type="button"
          onClick={onDisconnect}
          disabled={disconnecting || locked}
          className="text-body-sm leading-4 font-bold text-text-accent hover:underline disabled:opacity-50"
        >
          {disconnecting ? 'Desconectando...' : 'Desconectar'}
        </button>
      ) : (
        canConnect && (
          <button
            id={connectButtonId}
            type="button"
            onClick={onConnect}
            disabled={connecting || locked}
            className="text-body-sm leading-4 font-bold text-text-accent hover:underline disabled:opacity-50"
          >
            {connecting ? (
              'Conectando...'
            ) : (
              // No mobile o texto curto cabe na mesma linha do status, como no Figma.
              <>
                <span className="md:hidden">Conectar</span>
                <span className="hidden md:inline">Conectar carteira</span>
              </>
            )}
          </button>
        )
      )}
    </div>
  )
}

interface WalletCardsProps {
  variant: Variant
  wallets: WalletsResponse
  selected: WalletSlot
  disabled: boolean
  onSelect: (slot: WalletSlot) => void
}

export function WalletCards({ variant, wallets, selected, disabled, onSelect }: WalletCardsProps) {
  const slots = (['primary', 'secondary'] as const).filter((slot) => wallets[slot] !== null)

  return (
    <fieldset
      disabled={disabled}
      className={cn('grid gap-5', variant === 'desktop' && 'sm:grid-cols-2 sm:gap-x-6 sm:gap-y-3')}
    >
      <legend className="sr-only">Carteira para pagar</legend>
      {slots.map((slot) => (
        <WalletCard
          key={slot}
          slot={slot}
          wallet={wallets[slot]!}
          checked={selected === slot}
          onSelect={() => onSelect(slot)}
        />
      ))}
      {!wallets.secondary && (
        <Link
          to="/carteiras"
          className="flex h-[93px] items-center justify-center rounded-[14px] border border-dashed border-border-soft px-4 text-center text-body-sm text-text-accent hover:border-primary"
        >
          Cadastrar carteira reserva
        </Link>
      )}
    </fieldset>
  )
}

function WalletCard({
  slot,
  wallet,
  checked,
  onSelect,
}: {
  slot: WalletSlot
  wallet: Wallet
  checked: boolean
  onSelect: () => void
}) {
  const label = walletSlotLabels[slot]
  return (
    <div className="relative">
      <label className="block cursor-pointer">
        <input
          type="radio"
          name="checkout-wallet"
          value={slot}
          checked={checked}
          onChange={onSelect}
          className="peer sr-only"
        />
        <span
          className={cn(
            'flex h-[93px] gap-[19px] rounded-[14px] bg-surface-card pt-[15px] pr-10 pl-[19px]',
            checked && 'shadow-[0_4px_20px_rgb(0_0_0/0.35)]',
            radioFocus,
          )}
        >
          <RadioMark checked={checked} className="mt-6" />
          <span className="flex min-w-0 flex-col gap-1.5">
            <span className="text-body-md leading-4 font-bold text-foreground">{label}</span>
            <span className="text-body-sm leading-[22px] text-text-secondary">
              <span className="block truncate">{wallet.ensName || shortHex(wallet.address)}</span>
              <span className="block truncate">{networkDescriptions[wallet.network]}</span>
            </span>
          </span>
        </span>
      </label>
      <Link
        to="/carteiras"
        aria-label={`Editar carteira ${label}`}
        className="absolute top-[34px] right-2 grid size-6 place-items-center rounded text-secondary hover:text-text-accent"
      >
        <EllipsisVertical aria-hidden="true" className="size-5" />
      </Link>
    </div>
  )
}

const providerOrder: WalletType[] = ['walletconnect', 'metamask', 'coinbase']

function ProviderMark({ type }: { type: WalletType }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-10 shrink-0 place-items-center rounded-full border border-border bg-surface-raised text-body-sm leading-[18px] font-bold text-text-accent"
    >
      {type === 'walletconnect' && 'W'}
      {type === 'metamask' && 'M'}
      {/* Ícone da lucide no lugar do desenhado no Figma, com a mesma forma. */}
      {type === 'coinbase' && <WalletIcon className="size-6 text-primary" strokeWidth={1.5} />}
    </span>
  )
}

interface ProviderOptionsProps {
  variant: Variant
  selected: WalletType | null
  disabled: boolean
  onSelect: (type: WalletType) => void
}

export function ProviderOptions({ variant, selected, disabled, onSelect }: ProviderOptionsProps) {
  return (
    // Um <legend> não aceita bem margem dentro de flex: o título é um h2 ligado ao grupo.
    <div
      role="radiogroup"
      aria-labelledby="checkout-provider-title"
      className="flex flex-col gap-4"
    >
      <h2
        id="checkout-provider-title"
        className={cn(
          'font-bold text-foreground',
          variant === 'desktop'
            ? 'mb-1 text-center text-[17px] leading-4'
            : 'text-body-md leading-4',
        )}
      >
        Carteira e rede
      </h2>
      {providerOrder.map((type) => {
        const checked = selected === type
        return (
          <label key={type} className="block cursor-pointer">
            <input
              type="radio"
              name="checkout-provider"
              value={type}
              checked={checked}
              onChange={() => onSelect(type)}
              disabled={disabled}
              className="peer sr-only"
            />
            {variant === 'desktop' ? (
              <span
                className={cn(
                  'flex h-[45px] items-center gap-2.5 rounded-[3px] border px-3 text-body leading-5 text-foreground',
                  checked ? 'border-primary' : 'border-border',
                  radioFocus,
                )}
              >
                <RadioMark checked={checked} className="border-primary" />
                {walletTypeLabels[type]}
              </span>
            ) : (
              <span
                className={cn(
                  'flex h-[65px] items-center gap-[11px] rounded-[15px] bg-surface-card pr-4 pl-3.5 text-body-sm leading-4 text-foreground shadow-[0_4px_20px_rgb(0_0_0/0.3)]',
                  radioFocus,
                )}
              >
                <ProviderMark type={type} />
                <span className="flex-1">{walletTypeLabels[type]}</span>
                <RadioMark checked={checked} />
              </span>
            )}
          </label>
        )
      })}
    </div>
  )
}
