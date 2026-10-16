import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useSaveWallet } from '@/api/account'
import {
  saveWalletRequestSchema,
  walletTypeSchema,
  type Wallet,
  type WalletSlot,
} from '@/api/contracts/account'
import { networkSchema, type Network } from '@/api/contracts/common'
import { ApiRequestError } from '@/api/errors'
import { EnsField, FormField, FormSelect } from '@/components/form/FormField'
import { networkLabels, walletTypeLabels } from '@/lib/display'
import { showFieldErrors } from '@/lib/form-errors'
import { cn } from '@/lib/utils'

// Campos do formulário (com o ENS sem o ".eth") convertidos e validados pelo contrato:
// o endereço é conferido conforme a rede escolhida (0x... ou Solana).
const walletFormSchema = z
  .object({
    nickname: z.string(),
    network: z.string().min(1, 'Selecione uma rede.'),
    walletType: z.string().min(1, 'Selecione o tipo de carteira.'),
    address: z.string(),
    ensLabel: z
      .string()
      .trim()
      .regex(/^([a-z0-9-]{3,})?$/, 'Use pelo menos 3 letras minúsculas, números ou hífen.'),
  })
  // Depois de montar o pedido, valida pelo contrato e devolve os erros nos campos do formulário.
  .transform(({ ensLabel, ...wallet }, ctx) => {
    const result = saveWalletRequestSchema.safeParse({
      ...wallet,
      ensName: ensLabel ? `${ensLabel}.eth` : '',
    })
    if (result.success) return result.data
    for (const issue of result.error.issues) {
      const path = issue.path.map((part) => (part === 'ensName' ? 'ensLabel' : part))
      ctx.addIssue({ code: 'custom', message: issue.message, path })
    }
    return z.NEVER
  })

type WalletFormInput = z.input<typeof walletFormSchema>
type WalletFormOutput = z.output<typeof walletFormSchema>

const addressPlaceholders: Record<Network, string> = {
  ethereum: 'Endereço 0x da carteira',
  polygon: 'Endereço 0x da carteira',
  solana: 'Endereço Solana da carteira',
}

function walletFormValues(wallet: Wallet | null): WalletFormInput {
  return {
    nickname: wallet?.nickname ?? '',
    network: wallet?.network ?? '',
    walletType: wallet?.walletType ?? '',
    address: wallet?.address ?? '',
    ensLabel: wallet?.ensName.replace(/\.eth$/, '') ?? '',
  }
}

interface WalletFormProps {
  slot: WalletSlot
  // Dados que preenchem o formulário: a própria carteira ou, ao copiar, a principal.
  initialWallet: Wallet | null
  variant: 'desktop' | 'mobile'
  canCancel: boolean
  onSaved: () => void
  onCancel: () => void
}

export function WalletForm({
  slot,
  initialWallet,
  variant,
  canCancel,
  onSaved,
  onCancel,
}: WalletFormProps) {
  const saveWallet = useSaveWallet()
  const form = useForm<WalletFormInput, unknown, WalletFormOutput>({
    resolver: zodResolver(walletFormSchema),
    defaultValues: walletFormValues(initialWallet),
  })
  const { errors } = form.formState
  const network = useWatch({ control: form.control, name: 'network' }) as Network | ''
  const idFor = (field: string) => `${slot}-${field}`

  function onSubmit(wallet: WalletFormOutput) {
    saveWallet.mutate(
      { slot, wallet },
      {
        onSuccess: onSaved,
        onError: (error) => {
          if (!(error instanceof ApiRequestError)) return
          showFieldErrors(form, error.fields, { ensName: 'ensLabel' })
        },
      },
    )
  }

  const generalError =
    saveWallet.isError && Object.keys(saveWallet.error.fields).length === 0
      ? saveWallet.error.message
      : ''

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col">
      <fieldset
        disabled={saveWallet.isPending}
        className={cn('grid gap-x-7', variant === 'desktop' ? 'grid-cols-2 gap-y-5' : 'gap-y-4')}
      >
        <FormField
          id={idFor('nickname')}
          label="Apelido da carteira"
          variant={variant}
          required
          error={errors.nickname?.message}
          {...form.register('nickname')}
        />
        <FormSelect
          id={idFor('network')}
          label="Rede"
          variant={variant}
          required
          error={errors.network?.message}
          {...form.register('network')}
        >
          <option value="" disabled>
            Selecione uma rede
          </option>
          {networkSchema.options.map((option) => (
            <option key={option} value={option}>
              {networkLabels[option]}
            </option>
          ))}
        </FormSelect>
        <FormField
          id={idFor('address')}
          label="Endereço da carteira"
          variant={variant}
          required
          autoComplete="off"
          spellCheck={false}
          placeholder={network ? addressPlaceholders[network] : 'Endereço da carteira'}
          error={errors.address?.message}
          {...form.register('address')}
        />
        <FormSelect
          id={idFor('walletType')}
          label="Tipo de carteira"
          variant={variant}
          required
          error={errors.walletType?.message}
          {...form.register('walletType')}
        >
          <option value="" disabled>
            Selecione uma carteira
          </option>
          {walletTypeSchema.options.map((option) => (
            <option key={option} value={option}>
              {walletTypeLabels[option]}
            </option>
          ))}
        </FormSelect>
        <EnsField
          id={idFor('ensLabel')}
          label="Nome ENS (opcional)"
          variant={variant}
          placeholder="seunome"
          error={errors.ensLabel?.message}
          {...form.register('ensLabel')}
        />
      </fieldset>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saveWallet.isPending}
          className="flex h-10 items-center rounded-[3px] bg-primary px-4 text-body leading-4 font-bold text-ink hover:bg-text-accent disabled:opacity-60 max-md:rounded-full max-md:px-5"
        >
          {saveWallet.isPending ? 'Salvando...' : 'Salvar carteira'}
        </button>
        {canCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={saveWallet.isPending}
            className="flex h-10 items-center px-3 text-body leading-4 text-foreground hover:text-text-accent disabled:opacity-60"
          >
            Cancelar
          </button>
        )}
      </div>
      <p role="alert" className="mt-3 text-body-sm text-destructive empty:sr-only">
        {generalError}
      </p>
    </form>
  )
}
