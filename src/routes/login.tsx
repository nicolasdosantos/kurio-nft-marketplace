import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { z } from 'zod'
import { useLogin } from '@/api/auth'
import { loginRequestSchema } from '@/api/contracts/auth'
import { ApiRequestError } from '@/api/errors'
import { AuthField } from '@/components/auth/AuthField'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { ComingSoon } from '@/components/layout/ComingSoon'
import { focusHeaderLogin, safeRedirectPath } from '@/lib/auth-guard'
import { cn } from '@/lib/utils'

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

  function onSubmit(credentials: LoginForm) {
    login.mutate(credentials, {
      onSuccess: () => router.history.push(safeRedirectPath(redirect)),
      onError: (error) => {
        // Credenciais erradas aparecem no campo da senha, que é onde o usuário vai corrigir.
        if (error instanceof ApiRequestError && error.code === 'INVALID_CREDENTIALS') {
          form.setError('password', { message: error.message })
        }
      },
    })
  }

  const generalError =
    login.isError &&
    !(login.error instanceof ApiRequestError && login.error.code === 'INVALID_CREDENTIALS')
      ? login.error.message
      : ''

  return (
    <AuthLayout
      mode="login"
      description="Entre para gerenciar sua carteira, coleção e perfil de criador."
      mobileTitle="Entrar"
      redirect={redirect}
      initialFocusId="login-email"
      onClose={() => navigate({ to: '/' }).then(focusHeaderLogin)}
    >
      {(variant) => (
        <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col">
          {expired && (
            <p role="alert" className="mb-3 text-body-sm text-text-accent">
              Sua sessão expirou. Entre de novo para continuar de onde parou.
            </p>
          )}
          <div className="flex flex-col gap-3">
            <AuthField
              id="login-email"
              label="E-mail"
              variant={variant}
              type="email"
              autoComplete="email"
              placeholder="Digite seu e-mail"
              error={errors.email?.message}
              {...form.register('email')}
            />
            <AuthField
              id="login-password"
              label="Senha"
              variant={variant}
              type="password"
              autoComplete="current-password"
              placeholder="Senha"
              error={errors.password?.message}
              {...form.register('password')}
            />
          </div>
          {/* Recuperação de senha fica fora do escopo. */}
          <ComingSoon className="mt-3.5 self-end text-body-sm leading-4 text-text-accent">
            Esqueceu a senha?
          </ComingSoon>

          {generalError && (
            <p role="alert" className="mt-3 text-body-sm text-destructive">
              {generalError}
            </p>
          )}

          <button
            type="submit"
            disabled={login.isPending}
            className={cn(
              'bg-primary font-bold text-ink hover:bg-text-accent disabled:opacity-60',
              variant === 'desktop'
                ? 'mt-6 h-[45px] rounded-[4px] text-body'
                : 'mt-10 h-[60px] rounded-[10px] text-body',
            )}
          >
            {login.isPending ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      )}
    </AuthLayout>
  )
}
