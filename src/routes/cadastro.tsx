import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { z } from 'zod'
import { useRegister } from '@/api/auth'
import { registerRequestSchema } from '@/api/contracts/auth'
import { ApiRequestError } from '@/api/errors'
import { safeRedirectPath } from '@/lib/auth-guard'
import { AuthScreen } from '@/components/AuthScreen'

const registerSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
})

const registerFormSchema = registerRequestSchema.omit({ guestCartId: true })
type RegisterForm = z.infer<typeof registerFormSchema>

const fields = [
  { name: 'displayName', label: 'Nome de exibição', type: 'text', autoComplete: 'name' },
  { name: 'username', label: 'Nome de usuário', type: 'text', autoComplete: 'username' },
  { name: 'email', label: 'E-mail', type: 'email', autoComplete: 'email' },
  { name: 'password', label: 'Senha', type: 'password', autoComplete: 'new-password' },
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

  function onSubmit(account: RegisterForm) {
    register.mutate(account, {
      onSuccess: () => router.history.push(safeRedirectPath(redirect)),
      onError: (error) => {
        if (!(error instanceof ApiRequestError)) return
        for (const [field, message] of Object.entries(error.fields)) {
          form.setError(field as keyof RegisterForm, { message })
        }
      },
    })
  }

  const hasFieldErrors =
    register.error instanceof ApiRequestError && Object.keys(register.error.fields).length > 0

  return (
    <AuthScreen title="Criar perfil" onClose={() => navigate({ to: '/' })}>
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-2">
        {fields.map((field) => (
          <div key={field.name} className="flex flex-col">
            <label htmlFor={`register-${field.name}`}>{field.label}</label>
            <input
              id={`register-${field.name}`}
              type={field.type}
              autoComplete={field.autoComplete}
              {...form.register(field.name)}
              aria-invalid={errors[field.name] ? true : undefined}
              aria-describedby={errors[field.name] ? `register-${field.name}-error` : undefined}
              className="rounded border border-input bg-ink p-2"
            />
            {errors[field.name] && (
              <span id={`register-${field.name}-error`} className="text-destructive">
                {errors[field.name]?.message}
              </span>
            )}
          </div>
        ))}

        {register.isError && !hasFieldErrors && (
          <p role="alert" className="text-destructive">
            {register.error.message}
          </p>
        )}

        <button
          type="submit"
          disabled={register.isPending}
          className="mt-2 rounded bg-primary p-2 font-bold text-primary-foreground"
        >
          {register.isPending ? 'Criando...' : 'Criar perfil'}
        </button>
      </form>
      <p className="mt-4 text-center">
        Já tem conta?{' '}
        <Link to="/login" search={{ redirect }} className="underline">
          Entrar
        </Link>
      </p>
    </AuthScreen>
  )
}
