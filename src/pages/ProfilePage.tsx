import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useChangePassword, useProfile, useUpdateProfile } from '@/api/account'
import { changePasswordRequestSchema, updateProfileRequestSchema } from '@/api/contracts/account'
import { ApiRequestError } from '@/api/errors'
import { AccountLayout } from '@/components/account/AccountLayout'
import { AvatarField } from '@/components/account/AvatarField'
import { EnsField, FormField, PasswordField } from '@/components/form/FormField'
import { Skeleton } from '@/components/ui/skeleton'
import { showFieldErrors } from '@/lib/form-errors'
import { useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'

// O Figma mostra o ".eth" fixo ao lado do campo: o usuário digita só o nome.
const profileFormSchema = updateProfileRequestSchema.omit({ ensName: true }).extend({
  ensLabel: z
    .string()
    .trim()
    .regex(/^([a-z0-9-]{3,})?$/, 'Use pelo menos 3 letras minúsculas, números ou hífen.'),
})
type ProfileForm = z.infer<typeof profileFormSchema>

const passwordFormSchema = changePasswordRequestSchema
  .extend({ confirmPassword: z.string().min(1, 'Confirme a nova senha.') })
  .refine((passwords) => passwords.newPassword === passwords.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não são iguais.',
  })
type PasswordForm = z.infer<typeof passwordFormSchema>

const saveButton =
  'flex h-10 min-w-[131px] items-center justify-center self-start rounded-[3px] bg-primary px-5 text-body leading-4 font-bold text-ink hover:bg-text-accent disabled:opacity-60'

export function ProfilePage() {
  const profileQuery = useProfile()
  const isTabletUp = useMediaQuery('(min-width: 768px)')

  return (
    <AccountLayout section="profile">
      {profileQuery.isPending ? (
        <ProfileSkeleton />
      ) : profileQuery.isError ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-lg bg-surface-card p-6"
        >
          <p className="text-body-md font-bold">Não foi possível carregar o perfil.</p>
          <button
            type="button"
            onClick={() => profileQuery.refetch()}
            className="h-10 rounded-[3px] bg-primary px-4 text-body-sm font-bold text-ink"
          >
            Tentar de novo
          </button>
        </div>
      ) : (
        <ProfileForms profile={profileQuery.data} variant={isTabletUp ? 'desktop' : 'mobile'} />
      )}
    </AccountLayout>
  )
}

interface ProfileFormsProps {
  profile: NonNullable<ReturnType<typeof useProfile>['data']>
  variant: 'desktop' | 'mobile'
}

function ProfileForms({ profile, variant }: ProfileFormsProps) {
  const updateProfile = useUpdateProfile()
  const changePassword = useChangePassword()
  const [profileStatus, setProfileStatus] = useState('')
  const [avatarStatus, setAvatarStatus] = useState('')
  const [passwordStatus, setPasswordStatus] = useState('')
  const isDesktop = variant === 'desktop'

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileFormSchema),
    values: {
      displayName: profile.displayName,
      username: profile.username,
      email: profile.email,
      ensLabel: profile.ensName.replace(/\.eth$/, ''),
      walletNickname: profile.walletNickname,
    },
  })
  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })
  const profileErrors = profileForm.formState.errors
  const passwordErrors = passwordForm.formState.errors

  function saveProfile({ ensLabel, ...values }: ProfileForm) {
    setProfileStatus('')
    updateProfile.mutate(
      { ...values, ensName: ensLabel ? `${ensLabel}.eth` : '' },
      {
        onSuccess: () => setProfileStatus('Perfil salvo.'),
        onError: (error) => {
          // E-mail ou usuário em uso (409) e campos inválidos (422) voltam no campo certo.
          if (!(error instanceof ApiRequestError)) return
          showFieldErrors(profileForm, error.fields, { ensName: 'ensLabel' })
        },
      },
    )
  }

  function savePassword({ currentPassword, newPassword }: PasswordForm) {
    setPasswordStatus('')
    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          passwordForm.reset()
          setPasswordStatus('Senha alterada. Use a nova senha no próximo login.')
        },
        onError: (error) => {
          if (!(error instanceof ApiRequestError)) return
          showFieldErrors(passwordForm, error.fields)
        },
      },
    )
  }

  const profileGeneralError =
    updateProfile.isError && Object.keys(updateProfile.error.fields).length === 0
      ? updateProfile.error.message
      : ''
  const passwordGeneralError =
    changePassword.isError && Object.keys(changePassword.error.fields).length === 0
      ? changePassword.error.message
      : ''

  return (
    <div className="rise-in flex flex-col gap-8">
      <form
        noValidate
        aria-labelledby="profile-title"
        onSubmit={profileForm.handleSubmit(saveProfile)}
        className="flex flex-col"
      >
        <h1 id="profile-title" className="text-body-md leading-4 font-bold text-foreground">
          Perfil do colecionador
        </h1>
        <fieldset
          disabled={updateProfile.isPending}
          className={cn(
            'grid gap-x-7',
            isDesktop ? 'mt-[33px] grid-cols-2 gap-y-[34px]' : 'mt-6 gap-y-4',
          )}
        >
          <FormField
            id="profile-displayName"
            label="Nome de exibição"
            variant={variant}
            required
            autoComplete="name"
            error={profileErrors.displayName?.message}
            {...profileForm.register('displayName')}
          />
          <FormField
            id="profile-username"
            label="Nome de usuário"
            variant={variant}
            required
            autoComplete="username"
            error={profileErrors.username?.message}
            {...profileForm.register('username')}
          />
          <FormField
            id="profile-email"
            label="E-mail"
            type="email"
            variant={variant}
            required
            autoComplete="email"
            error={profileErrors.email?.message}
            {...profileForm.register('email')}
          />
          <EnsField
            id="profile-ensLabel"
            label="Nome ENS"
            variant={variant}
            placeholder="seunome"
            error={profileErrors.ensLabel?.message}
            {...profileForm.register('ensLabel')}
          />
          <FormField
            id="profile-walletNickname"
            label="Apelido da carteira"
            variant={variant}
            required
            error={profileErrors.walletNickname?.message}
            {...profileForm.register('walletNickname')}
          />
          <AvatarField avatarUrl={profile.avatarUrl} onStatus={setAvatarStatus} />
        </fieldset>
        <p role="status" className="mt-3 text-body-sm text-text-accent empty:sr-only">
          {avatarStatus}
        </p>
        <button type="submit" disabled={updateProfile.isPending} className={cn(saveButton, 'mt-5')}>
          {updateProfile.isPending ? 'Salvando...' : 'Salvar perfil'}
        </button>
        <p
          role="status"
          data-testid="profile-status"
          className="mt-3 text-body-sm text-text-accent empty:sr-only"
        >
          {profileStatus}
        </p>
        <p role="alert" className="mt-3 text-body-sm text-destructive empty:sr-only">
          {profileGeneralError}
        </p>
      </form>

      <form
        noValidate
        aria-labelledby="password-title"
        onSubmit={passwordForm.handleSubmit(savePassword)}
        className="flex flex-col"
      >
        <h2 id="password-title" className="text-body-md leading-4 font-bold text-foreground">
          Alterar senha
        </h2>
        <fieldset
          disabled={changePassword.isPending}
          className={cn(
            'mt-[22px] flex flex-col',
            isDesktop ? 'max-w-[418px] gap-[22px]' : 'gap-4',
          )}
        >
          <PasswordField
            id="password-current"
            label="Senha atual"
            variant={variant}
            autoComplete="current-password"
            error={passwordErrors.currentPassword?.message}
            {...passwordForm.register('currentPassword')}
          />
          <PasswordField
            id="password-new"
            label="Nova senha"
            variant={variant}
            autoComplete="new-password"
            hint="Pelo menos 8 caracteres."
            error={passwordErrors.newPassword?.message}
            {...passwordForm.register('newPassword')}
          />
          <PasswordField
            id="password-confirm"
            label="Confirmar nova senha"
            variant={variant}
            autoComplete="new-password"
            error={passwordErrors.confirmPassword?.message}
            {...passwordForm.register('confirmPassword')}
          />
        </fieldset>
        <button
          type="submit"
          disabled={changePassword.isPending}
          className={cn(saveButton, 'mt-8')}
        >
          {changePassword.isPending ? 'Salvando...' : 'Salvar senha'}
        </button>
        <p
          role="status"
          data-testid="password-status"
          className="mt-3 text-body-sm text-text-accent empty:sr-only"
        >
          {passwordStatus}
        </p>
        <p role="alert" className="mt-3 text-body-sm text-destructive empty:sr-only">
          {passwordGeneralError}
        </p>
      </form>
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando perfil" className="flex flex-col gap-8">
      <Skeleton className="h-4 w-56" />
      <div className="grid gap-x-7 gap-y-[34px] md:grid-cols-2">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-[69px]" />
        ))}
      </div>
    </div>
  )
}
