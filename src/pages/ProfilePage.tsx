import { useForm, type FieldValues, type Path, type UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'
import { z } from 'zod'
import {
  useChangePassword,
  useProfile,
  useRemoveAvatar,
  useUpdateAvatar,
  useUpdateProfile,
} from '@/api/account'
import {
  changePasswordRequestSchema,
  updateProfileRequestSchema,
  type UpdateProfileRequest,
} from '@/api/contracts/account'
import { ApiRequestError } from '@/api/errors'
import { useFavorites } from '@/api/favorites'
import { useOrders } from '@/api/orders'

const passwordFormSchema = changePasswordRequestSchema
  .extend({ confirmPassword: z.string() })
  .refine((passwords) => passwords.newPassword === passwords.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem.',
  })
type PasswordForm = z.infer<typeof passwordFormSchema>

// Erros de campo que vêm da API (ex.: e-mail em uso) aparecem embaixo do campo certo.
function showServerErrors<Form extends FieldValues>(form: UseFormReturn<Form>, error: unknown) {
  if (!(error instanceof ApiRequestError)) return
  for (const [field, message] of Object.entries(error.fields)) {
    form.setError(field as Path<Form>, { message })
  }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function ProfilePage() {
  const profileQuery = useProfile()
  const favoritesQuery = useFavorites()
  const ordersQuery = useOrders()
  const updateProfile = useUpdateProfile()
  const updateAvatar = useUpdateAvatar()
  const removeAvatar = useRemoveAvatar()
  const changePassword = useChangePassword()

  const profileForm = useForm<UpdateProfileRequest>({
    resolver: zodResolver(updateProfileRequestSchema),
    values: profileQuery.data && {
      displayName: profileQuery.data.displayName,
      username: profileQuery.data.username,
      email: profileQuery.data.email,
      ensName: profileQuery.data.ensName,
      walletNickname: profileQuery.data.walletNickname,
    },
  })
  const passwordForm = useForm<PasswordForm>({ resolver: zodResolver(passwordFormSchema) })

  if (profileQuery.isPending) return <main className="p-4">Carregando perfil...</main>
  if (profileQuery.isError) return <main className="p-4">{profileQuery.error.message}</main>

  const profile = profileQuery.data
  const profileErrors = profileForm.formState.errors
  const passwordErrors = passwordForm.formState.errors

  async function handleAvatarChange(file: File | undefined) {
    if (!file) return
    updateAvatar.mutate(await readFileAsDataUrl(file))
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4">
      <h1 className="text-heading font-bold">Perfil do colecionador</h1>
      <p data-testid="profile-email">{profile.email}</p>

      <form
        noValidate
        onSubmit={profileForm.handleSubmit((values) =>
          updateProfile.mutate(values, {
            onError: (error) => showServerErrors(profileForm, error),
          }),
        )}
        className="flex flex-col gap-2"
      >
        {(
          [
            ['displayName', 'Nome de exibição'],
            ['username', 'Nome de usuário'],
            ['email', 'E-mail'],
            ['ensName', 'Nome ENS'],
            ['walletNickname', 'Apelido da carteira'],
          ] as const
        ).map(([field, label]) => (
          <div key={field} className="flex flex-col">
            <label htmlFor={`profile-${field}`}>{label}</label>
            <input
              id={`profile-${field}`}
              {...profileForm.register(field)}
              aria-invalid={profileErrors[field] ? true : undefined}
              aria-describedby={profileErrors[field] ? `profile-${field}-error` : undefined}
              className="rounded border border-input bg-ink p-1"
            />
            {profileErrors[field] && (
              <span id={`profile-${field}-error`} className="text-destructive">
                {profileErrors[field].message}
              </span>
            )}
          </div>
        ))}
        <button
          type="submit"
          className="self-start rounded bg-primary px-3 py-1 text-primary-foreground"
        >
          Salvar
        </button>
        <p role="status">{updateProfile.isSuccess && 'Perfil atualizado.'}</p>
      </form>

      <section aria-label="Avatar" className="flex flex-col gap-2">
        <h2 className="font-bold">Avatar</h2>
        {profile.avatarUrl ? (
          <img
            src={profile.avatarUrl}
            alt="Seu avatar"
            width={64}
            height={64}
            className="rounded-full"
          />
        ) : (
          <p>Sem avatar.</p>
        )}
        <label htmlFor="avatar-file">Alterar avatar (PNG, JPEG ou WebP até 1 MB)</label>
        <input
          id="avatar-file"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => handleAvatarChange(event.target.files?.[0])}
        />
        {profile.avatarUrl && (
          <button
            type="button"
            onClick={() => removeAvatar.mutate()}
            className="self-start underline"
          >
            Remover avatar
          </button>
        )}
        {updateAvatar.isError && (
          <p role="alert" className="text-destructive">
            {updateAvatar.error.fields.imageDataUrl ?? updateAvatar.error.message}
          </p>
        )}
      </section>

      <form
        noValidate
        onSubmit={passwordForm.handleSubmit(({ currentPassword, newPassword }) =>
          changePassword.mutate(
            { currentPassword, newPassword },
            {
              onSuccess: () => passwordForm.reset(),
              onError: (error) => showServerErrors(passwordForm, error),
            },
          ),
        )}
        className="flex flex-col gap-2"
      >
        <h2 className="font-bold">Alterar senha</h2>
        {(
          [
            ['currentPassword', 'Senha atual'],
            ['newPassword', 'Nova senha'],
            ['confirmPassword', 'Confirmar nova senha'],
          ] as const
        ).map(([field, label]) => (
          <div key={field} className="flex flex-col">
            <label htmlFor={`password-${field}`}>{label}</label>
            <input
              id={`password-${field}`}
              type="password"
              autoComplete={field === 'currentPassword' ? 'current-password' : 'new-password'}
              {...passwordForm.register(field)}
              aria-invalid={passwordErrors[field] ? true : undefined}
              aria-describedby={passwordErrors[field] ? `password-${field}-error` : undefined}
              className="rounded border border-input bg-ink p-1"
            />
            {passwordErrors[field] && (
              <span id={`password-${field}-error`} className="text-destructive">
                {passwordErrors[field].message}
              </span>
            )}
          </div>
        ))}
        <button
          type="submit"
          className="self-start rounded bg-primary px-3 py-1 text-primary-foreground"
        >
          Alterar senha
        </button>
        <p role="status">{changePassword.isSuccess && 'Senha alterada.'}</p>
      </form>

      <section aria-label="Favoritos">
        <h2 className="font-bold">Lista de interesse</h2>
        <ul data-testid="favorite-list">
          {favoritesQuery.data?.nftIds.map((nftId) => (
            <li key={nftId}>
              <Link to="/nft/$nftId" params={{ nftId }} className="underline">
                {nftId}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Pedidos">
        <h2 className="font-bold">Pedidos</h2>
        <ul data-testid="order-list">
          {ordersQuery.data?.map((order) => (
            <li key={order.id}>
              <Link to="/pedidos/$orderId" params={{ orderId: order.id }} className="underline">
                {order.id}
              </Link>{' '}
              · {order.status} · {order.receipt.totalEth} ETH
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
