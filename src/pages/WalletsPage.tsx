import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRemoveSecondaryWallet, useSaveWallet, useWallets } from '@/api/account'
import {
  saveWalletRequestSchema,
  type SaveWalletRequest,
  type Wallet,
  type WalletSlot,
} from '@/api/contracts/account'
import { ApiRequestError } from '@/api/errors'

const slotTitles: Record<WalletSlot, string> = {
  primary: 'Carteira principal',
  secondary: 'Carteira secundária',
}

function WalletForm({ slot, wallet }: { slot: WalletSlot; wallet: Wallet | null }) {
  const saveWallet = useSaveWallet()
  const form = useForm<SaveWalletRequest>({
    resolver: zodResolver(saveWalletRequestSchema),
    defaultValues: {
      nickname: wallet?.nickname ?? '',
      network: wallet?.network ?? 'ethereum',
      walletType: wallet?.walletType ?? 'metamask',
      address: wallet?.address ?? '',
      ensName: wallet?.ensName ?? '',
    },
  })
  const { errors } = form.formState
  const idFor = (field: string) => `${slot}-${field}`

  function onSubmit(values: SaveWalletRequest) {
    saveWallet.mutate(
      { slot, wallet: values },
      {
        onError: (error) => {
          if (!(error instanceof ApiRequestError)) return
          for (const [field, message] of Object.entries(error.fields)) {
            form.setError(field as keyof SaveWalletRequest, { message })
          }
        },
      },
    )
  }

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(onSubmit)}
      aria-label={slotTitles[slot]}
      className="flex flex-col gap-2"
    >
      <label htmlFor={idFor('nickname')}>Apelido da carteira</label>
      <input
        id={idFor('nickname')}
        {...form.register('nickname')}
        aria-invalid={errors.nickname ? true : undefined}
        aria-describedby={errors.nickname ? idFor('nickname-error') : undefined}
        className="rounded border border-input bg-ink p-1"
      />
      {errors.nickname && (
        <span id={idFor('nickname-error')} className="text-destructive">
          {errors.nickname.message}
        </span>
      )}

      <label htmlFor={idFor('network')}>Rede</label>
      <select
        id={idFor('network')}
        {...form.register('network')}
        className="rounded border bg-ink p-1"
      >
        <option value="ethereum">Ethereum</option>
        <option value="polygon">Polygon</option>
        <option value="solana">Solana</option>
      </select>

      <label htmlFor={idFor('walletType')}>Tipo de carteira</label>
      <select
        id={idFor('walletType')}
        {...form.register('walletType')}
        className="rounded border bg-ink p-1"
      >
        <option value="metamask">MetaMask</option>
        <option value="walletconnect">WalletConnect</option>
        <option value="coinbase">Coinbase Wallet</option>
      </select>

      <label htmlFor={idFor('address')}>Endereço da carteira</label>
      <input
        id={idFor('address')}
        {...form.register('address')}
        aria-invalid={errors.address ? true : undefined}
        aria-describedby={errors.address ? idFor('address-error') : undefined}
        className="rounded border border-input bg-ink p-1"
      />
      {errors.address && (
        <span id={idFor('address-error')} className="text-destructive">
          {errors.address.message}
        </span>
      )}

      <label htmlFor={idFor('ensName')}>Nome ENS (opcional)</label>
      <input
        id={idFor('ensName')}
        {...form.register('ensName')}
        aria-invalid={errors.ensName ? true : undefined}
        className="rounded border border-input bg-ink p-1"
      />
      {errors.ensName && <span className="text-destructive">{errors.ensName.message}</span>}

      <button
        type="submit"
        className="self-start rounded bg-primary px-3 py-1 text-primary-foreground"
      >
        Salvar carteira
      </button>
      <p role="status">{saveWallet.isSuccess && 'Carteira salva.'}</p>
      {saveWallet.isError && Object.keys(saveWallet.error.fields).length === 0 && (
        <p role="alert" className="text-destructive">
          {saveWallet.error.message}
        </p>
      )}
    </form>
  )
}

export function WalletsPage() {
  const walletsQuery = useWallets()
  const removeSecondary = useRemoveSecondaryWallet()

  if (walletsQuery.isPending) return <main className="p-4">Carregando carteiras...</main>
  if (walletsQuery.isError) return <main className="p-4">{walletsQuery.error.message}</main>

  const { primary, secondary } = walletsQuery.data

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4">
      <h1 className="text-heading font-bold">Carteiras</h1>
      <section className="flex flex-col gap-2">
        <h2 className="font-bold">{slotTitles.primary}</h2>
        <WalletForm key={primary?.updatedAt ?? 'novo'} slot="primary" wallet={primary} />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="font-bold">{slotTitles.secondary}</h2>
        {primary ? (
          <>
            <WalletForm key={secondary?.updatedAt ?? 'novo'} slot="secondary" wallet={secondary} />
            {secondary && (
              <button
                type="button"
                onClick={() => removeSecondary.mutate()}
                className="self-start underline"
              >
                Remover carteira secundária
              </button>
            )}
          </>
        ) : (
          <p>Cadastre a carteira principal primeiro.</p>
        )}
      </section>
    </main>
  )
}
