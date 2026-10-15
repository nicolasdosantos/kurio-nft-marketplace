import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { z } from 'zod'
import { useRegister } from '@/api/auth'
import { registerRequestSchema } from '@/api/contracts/auth'
import { ApiRequestError } from '@/api/errors'
import { AuthField } from '@/components/auth/AuthField'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { focusHeaderLogin, safeRedirectPath } from '@/lib/auth-guard'
import { cn } from '@/lib/utils'

const registerSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
})

// O Figma não tem o campo de nome de exibição: ele começa igual ao nome de usuário
// e pode ser trocado depois no perfil.
const registerFormSchema = registerRequestSchema
  .omit({ displayName: true, guestCartId: true })
  .extend({ confirmPassword: z.string().min(1, 'Confirme a senha.') })
  .refine((account) => account.password === account.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não são iguais.',
  })
type RegisterForm = z.infer<typeof registerFormSchema>

const fields = [
  {
    name: 'username',
    label: 'Nome de usuário',
    placeholder: 'Nome de usuário',
    type: 'text',
    autoComplete: 'username',
  },
  {
    name: 'email',
    label: 'E-mail',
    placeholder: 'Digite seu e-mail',
    type: 'email',
    autoComplete: 'email',
  },
  {
    name: 'password',
    label: 'Senha',
    placeholder: 'Senha',
    type: 'password',
    autoComplete: 'new-password',
  },
  {
    name: 'confirmPassword',
    label: 'Confirmar senha',
    placeholder: 'Confirmar senha',
    type: 'password',
    autoComplete: 'new-password',
  },
] as const

export const Route = createFileRoute('/cadastro')({
  validateSearch: (search) => registerSearchSchema.parse(search),
  component: RegisterRoute,
})

function RegisterRoute() {
  const { redirect } = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()
  const register = useRegister()
  const form = useForm<RegisterForm>({ resolver: zodResolver(registerFormSchema) })
  const { errors } = form.formState

  function onSubmit({ username, email, password }: RegisterForm) {
    register.mutate(
      { displayName: username, username, email, password },
      {
        onSuccess: () => router.history.push(safeRedirectPath(redirect)),
        onError: (error) => {
          // E-mail ou usuário em uso (409) e campos inválidos (422) voltam no campo certo.
          if (!(error instanceof ApiRequestError)) return
          for (const [field, message] of Object.entries(error.fields)) {
            if (field === 'displayName') continue
            form.setError(field as keyof RegisterForm, { message })
          }
        },
      },
    )
  }

  const hasFieldErrors =
    register.error instanceof ApiRequestError && Object.keys(register.error.fields).length > 0

  return (
    <AuthLayout
      mode="register"
      description="Crie seu perfil de colecionador e conecte uma carteira quando quiser."
      mobileTitle="Criar perfil de colecionador"
      redirect={redirect}
      initialFocusId="register-username"
      onClose={() => navigate({ to: '/' }).then(focusHeaderLogin)}
    >
      {(variant) => (
        <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col">
          <div className="flex flex-col gap-3">
            {fields.map((field) => (
              <AuthField
                key={field.name}
                id={`register-${field.name}`}
                label={field.label}
                variant={variant}
                type={field.type}
                autoComplete={field.autoComplete}
                placeholder={field.placeholder}
                error={errors[field.name]?.message}
                {...form.register(field.name)}
              />
            ))}
          </div>

          {register.isError && !hasFieldErrors && (
            <p role="alert" className="mt-3 text-body-sm text-destructive">
              {register.error.message}
            </p>
          )}

          <button
            type="submit"
            disabled={register.isPending}
            className={cn(
              'bg-primary font-bold text-ink hover:bg-text-accent disabled:opacity-60',
              variant === 'desktop'
                ? 'mt-6 h-[45px] rounded-[4px] text-body'
                : 'mt-10 h-[60px] rounded-[10px] text-body',
            )}
          >
            {register.isPending
              ? 'Criando...'
              : variant === 'desktop'
                ? 'Criar conta'
                : 'Criar perfil'}
          </button>
        </form>
      )}
    </AuthLayout>
  )
}
