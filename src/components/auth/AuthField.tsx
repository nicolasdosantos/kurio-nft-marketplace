import { useState, type ComponentProps } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AuthFieldProps extends ComponentProps<'input'> {
  id: string
  // O Figma só mostra o placeholder; o rótulo fica para o leitor de tela.
  label: string
  error?: string
  variant: 'desktop' | 'mobile'
}

const variants = {
  desktop: 'h-10 rounded-[4px] bg-surface-card pl-4',
  mobile: 'h-[50px] rounded-[10px] bg-ink pl-4',
}

export function AuthField({
  id,
  label,
  error,
  variant,
  type,
  className,
  ...props
}: AuthFieldProps) {
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const errorId = `${id}-error`

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div
        className={cn(
          // Borda primary do Figma no foco, mais o anel de foco do app para quem usa teclado.
          'flex items-center border border-field-border pr-3 focus-within:border-primary has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-text-accent',
          error && 'border-destructive focus-within:border-destructive',
          variants[variant],
          className,
        )}
      >
        <input
          id={id}
          type={isPassword && showPassword ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="h-full min-w-0 flex-1 bg-transparent text-body-sm text-foreground outline-none placeholder:text-secondary"
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((current) => !current)}
            className="grid size-6 shrink-0 place-items-center text-secondary"
          >
            {showPassword ? (
              <Eye aria-hidden="true" className="size-4" />
            ) : (
              <EyeOff aria-hidden="true" className="size-4" />
            )}
          </button>
        )}
      </div>
      {error && (
        <span id={errorId} className="text-caption text-destructive">
          {error}
        </span>
      )}
    </div>
  )
}
