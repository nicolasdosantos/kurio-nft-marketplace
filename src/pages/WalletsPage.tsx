import { useEffect, useRef, useState } from 'react'
import {
  useConnectWallet,
  useDisconnectWallet,
  useRemoveSecondaryWallet,
  useWallets,
} from '@/api/account'
import type { Wallet, WalletSlot } from '@/api/contracts/account'
import { AccountLayout } from '@/components/account/AccountLayout'
import { WalletForm } from '@/components/account/WalletForm'
import { Skeleton } from '@/components/ui/skeleton'
import { networkLabels, walletSlotLabels, walletTypeLabels } from '@/lib/display'
import { useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'

const titles: Record<WalletSlot, string> = {
  primary: 'Carteira principal',
  secondary: 'Carteira secundária',
}

const linkButton =
  'text-body-md leading-4 font-bold text-text-accent hover:underline disabled:opacity-60'

export function WalletsPage() {
  const walletsQuery = useWallets()
  const isTabletUp = useMediaQuery('(min-width: 768px)')

  return (
    <AccountLayout section="wallets">
      <h1 className="sr-only">Carteiras</h1>
      {walletsQuery.isPending ? (
        <div aria-busy="true" aria-label="Carregando carteiras" className="flex flex-col gap-6">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-[140px] rounded-[14px]" />
          <Skeleton className="h-4 w-48" />
        </div>
      ) : walletsQuery.isError ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-lg bg-surface-card p-6"
        >
          <p className="text-body-md font-bold">Não foi possível carregar as carteiras.</p>
          <button
            type="button"
            onClick={() => walletsQuery.refetch()}
            className="h-10 rounded-[3px] bg-primary px-4 text-body-sm font-bold text-ink"
          >
            Tentar de novo
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          <WalletSection
            slot="primary"
            wallet={walletsQuery.data.primary}
            primary={walletsQuery.data.primary}
            variant={isTabletUp ? 'desktop' : 'mobile'}
          />
          <WalletSection
            slot="secondary"
            wallet={walletsQuery.data.secondary}
            primary={walletsQuery.data.primary}
            variant={isTabletUp ? 'desktop' : 'mobile'}
          />
        </div>
      )}
    </AccountLayout>
  )
}

interface WalletSectionProps {
  slot: WalletSlot
  wallet: Wallet | null
  primary: Wallet | null
  variant: 'desktop' | 'mobile'
}

function WalletSection({ slot, wallet, primary, variant }: WalletSectionProps) {
  // A principal sem cadastro já abre o formulário, como no Figma.
  const [editing, setEditing] = useState(slot === 'primary' && wallet === null)
  const [copyPrimary, setCopyPrimary] = useState(false)
  const [status, setStatus] = useState('')
  const title = titles[slot]
  const blockedByPrimary = slot === 'secondary' && primary === null
  const actionId = `${slot}-wallet-action`
  // Depois de salvar ou remover, o foco vai para a ação que continua na tela ("Editar" ou
  // "Adicionar"). Ela só existe depois da renderização (e, na remoção, depois do refetch).
  const focusAction = useRef(false)
  useEffect(() => {
    if (!focusAction.current || editing) return
    const action = document.getElementById(actionId)
    if (!action) return
    focusAction.current = false
    action.focus()
  }, [editing, wallet, actionId])

  function openForm() {
    setStatus('')
    setEditing(true)
  }

  function closeForm() {
    setEditing(false)
    setCopyPrimary(false)
    focusAction.current = true
  }

  function toggleCopy(checked: boolean) {
    setCopyPrimary(checked)
    if (checked) {
      setEditing(true)
      setStatus('Dados da carteira principal copiados para o formulário.')
    } else {
      setStatus('')
    }
  }

  return (
    <section aria-labelledby={`${slot}-wallet-title`} className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <h2
          id={`${slot}-wallet-title`}
          className="text-body-md leading-4 font-bold text-foreground"
        >
          {title}
        </h2>
        <div className="flex flex-wrap items-center gap-5">
          {slot === 'secondary' && (
            <label
              className={cn(
                'flex items-center gap-2 text-body leading-5 text-foreground',
                primary ? 'cursor-pointer' : 'cursor-not-allowed opacity-60',
              )}
            >
              <input
                type="checkbox"
                checked={copyPrimary}
                disabled={!primary}
                onChange={(event) => toggleCopy(event.target.checked)}
                className="peer sr-only"
              />
              {/* Círculo do Figma; o checkbox de verdade fica escondido logo antes. */}
              <span
                aria-hidden="true"
                className="grid size-4 place-items-center rounded-full border-[1.5px] border-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-text-accent"
              >
                {copyPrimary && <span className="size-2 rounded-full bg-primary" />}
              </span>
              Igual à carteira principal
            </label>
          )}
          {!editing && !blockedByPrimary && (
            <button id={actionId} type="button" onClick={openForm} className={linkButton}>
              {wallet ? 'Editar' : 'Adicionar'}
              <span className="sr-only"> {title.toLowerCase()}</span>
            </button>
          )}
        </div>
      </div>
      {slot === 'primary' && (
        <p className="mt-2 text-caption leading-4 text-text-secondary">
          Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.
        </p>
      )}

      {/* Texto de "nenhuma carteira" mais perto do título, como no Figma. */}
      <div className={editing || wallet ? 'mt-[33px]' : 'mt-4'}>
        {editing ? (
          <WalletForm
            // Remonta ao copiar ou desfazer a cópia, para trocar os valores iniciais.
            key={copyPrimary ? 'copia' : 'propria'}
            slot={slot}
            initialWallet={copyPrimary ? primary : wallet}
            variant={variant}
            canCancel={wallet !== null || slot === 'secondary'}
            onSaved={() => {
              setStatus(`${title} salva.`)
              closeForm()
            }}
            onCancel={() => {
              setStatus('')
              closeForm()
            }}
          />
        ) : wallet ? (
          <WalletCard
            slot={slot}
            wallet={wallet}
            onRemoved={() => {
              setStatus(`${title} removida.`)
              focusAction.current = true
            }}
          />
        ) : (
          <p className="text-body leading-5 text-text-secondary">
            {blockedByPrimary
              ? 'Cadastre a carteira principal antes da secundária.'
              : `Você ainda não adicionou uma ${title.toLowerCase()}.`}
          </p>
        )}
      </div>
      <p
        role="status"
        data-testid={`${slot}-wallet-status`}
        className="mt-3 text-body-sm text-text-accent empty:sr-only"
      >
        {status}
      </p>
    </section>
  )
}

function WalletCard({
  slot,
  wallet,
  onRemoved,
}: {
  slot: WalletSlot
  wallet: Wallet
  onRemoved: () => void
}) {
  const connectWallet = useConnectWallet()
  const disconnectWallet = useDisconnectWallet()
  const removeSecondary = useRemoveSecondaryWallet()
  const [connected, setConnected] = useState(false)
  const [confirmingRemoval, setConfirmingRemoval] = useState(false)
  const [message, setMessage] = useState('')
  const busy = connectWallet.isPending || disconnectWallet.isPending || removeSecondary.isPending
  const slotLabel = walletSlotLabels[slot]
  const error =
    connectWallet.error?.message ??
    disconnectWallet.error?.message ??
    removeSecondary.error?.message

  function connect() {
    setMessage(`Aguardando a aprovação no ${walletTypeLabels[wallet.walletType]}...`)
    connectWallet.mutate(
      { slot, network: wallet.network, walletType: wallet.walletType },
      {
        onSuccess: () => {
          setConnected(true)
          setMessage(`Carteira ${slotLabel} conectada.`)
        },
        onError: () => setMessage(''),
      },
    )
  }

  function disconnect() {
    disconnectWallet.mutate(slot, {
      onSuccess: () => {
        setConnected(false)
        setMessage(`Carteira ${slotLabel} desconectada.`)
      },
    })
  }

  return (
    <div
      data-testid={`${slot}-wallet-card`}
      className="flex flex-col gap-4 rounded-[14px] bg-surface-card p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <dl className="grid min-w-0 gap-x-6 gap-y-3 text-body-sm leading-5 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col">
            <dt className="text-text-secondary">Apelido</dt>
            <dd className="font-bold text-foreground">{wallet.nickname}</dd>
          </div>
          <div className="flex min-w-0 flex-col">
            <dt className="text-text-secondary">Rede e tipo</dt>
            <dd className="text-foreground">
              {networkLabels[wallet.network]} · {walletTypeLabels[wallet.walletType]}
            </dd>
          </div>
          <div className="flex min-w-0 flex-col sm:col-span-2">
            <dt className="text-text-secondary">Endereço</dt>
            <dd className="font-mono break-all text-foreground">{wallet.address}</dd>
          </div>
          {wallet.ensName && (
            <div className="flex min-w-0 flex-col">
              <dt className="text-text-secondary">Nome ENS</dt>
              <dd className="text-foreground">{wallet.ensName}</dd>
            </div>
          )}
        </dl>
        <span
          className={cn(
            'rounded-full border px-3 py-1 text-caption leading-4 font-bold',
            connected ? 'border-primary text-text-accent' : 'border-border text-text-secondary',
          )}
        >
          {connected ? 'Conectada' : 'Desconectada'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        {connected ? (
          <button type="button" onClick={disconnect} disabled={busy} className={linkButton}>
            {disconnectWallet.isPending ? 'Desconectando...' : 'Desconectar'}
          </button>
        ) : (
          <button type="button" onClick={connect} disabled={busy} className={linkButton}>
            {connectWallet.isPending ? 'Conectando...' : 'Conectar'}
            <span className="sr-only"> carteira {slotLabel}</span>
          </button>
        )}
        {slot === 'secondary' &&
          (confirmingRemoval ? (
            <span role="group" aria-label="Confirmar remoção" className="flex items-center gap-3">
              <span className="text-body-sm text-foreground">Remover a carteira secundária?</span>
              <button
                type="button"
                autoFocus
                disabled={busy}
                onClick={() => removeSecondary.mutate(undefined, { onSuccess: onRemoved })}
                className="h-9 rounded-[3px] bg-destructive px-3 text-body-sm font-bold text-ink disabled:opacity-60"
              >
                {removeSecondary.isPending ? 'Removendo...' : 'Remover'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmingRemoval(false)}
                className="text-body-sm text-foreground hover:text-text-accent"
              >
                Cancelar
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingRemoval(true)}
              disabled={busy}
              className="text-body-md leading-4 text-foreground hover:text-destructive disabled:opacity-60"
            >
              Remover carteira secundária
            </button>
          ))}
      </div>
      <p role="status" className="text-body-sm text-text-accent empty:sr-only">
        {message}
      </p>
      <p role="alert" className="text-body-sm text-destructive empty:sr-only">
        {error}
      </p>
    </div>
  )
}
