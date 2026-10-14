import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { z } from 'zod'
import { useLogin } from '@/api/auth'
import { loginRequestSchema } from '@/api/contracts/auth'
import { safeRedirectPath } from '@/lib/auth-guard'
import { AuthScreen } from '@/components/AuthScreen'

const loginSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
  expired: z.boolean().optional().catch(undefined),
})

const loginFormSchema = loginRequestSchema.omit({ guestCartId: true })
type LoginForm = z.infer<typeof loginFormSchema>

export const Route = createFileRoute('/login')({
  validateSearch: (search) => loginSearchSchema.parse(search),
  component: LoginRoute,
})

function LoginRoute() {
  const { redirect, expired } = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()
  const login = useLogin()
  const form = useForm<LoginForm>({ resolver: zodResolver(loginFormSchema) })
  const { errors } = form.formState
  const nextPath = safeRedirectPath(redirect)

  function onSubmit(credentials: LoginForm) {
    login.mutate(credentials, { onSuccess: () => router.history.push(nextPath) })
  }

  return (
    <AuthScreen title="Entrar" onClose={() => navigate({ to: '/' })}>
      {expired && (
        <p role="alert" className="mb-3 text-text-accent">
          Sua sessão expirou. Entre de novo para continuar de onde parou.
        </p>
      )}
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-2">
        <label htmlFor="login-email">E-mail</label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          {...form.register('email')}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? 'login-email-error' : undefined}
          className="rounded border border-input bg-ink p-2"
        />
        {errors.email && (
          <span id="login-email-error" className="text-destructive">
            {errors.email.message}
          </span>
        )}

        <label htmlFor="login-password">Senha</label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          {...form.register('password')}
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={errors.password ? 'login-password-error' : undefined}
          className="rounded border border-input bg-ink p-2"
        />
        {errors.password && (
          <span id="login-password-error" className="text-destructive">
            {errors.password.message}
          </span>
        )}

        {login.isError && (
          <p role="alert" className="text-destructive">
            {login.error.message}
          </p>
        )}

        <button
          type="submit"
          disabled={login.isPending}
          className="mt-2 rounded bg-primary p-2 font-bold text-primary-foreground"
        >
          {login.isPending ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
      <p className="mt-4 text-center">
        Não tem conta?{' '}
        <Link to="/cadastro" search={{ redirect }} className="underline">
          Criar perfil
        </Link>
      </p>
    </AuthScreen>
  )
}
