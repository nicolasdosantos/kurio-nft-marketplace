import { useState, type ComponentProps, type ReactNode } from 'react'
import { ChevronDown, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

// Campos dos formulários do Figma (pagamento, perfil, carteiras): rótulo visível com
// asterisco nos obrigatórios e erro embaixo, ligado ao campo por aria-describedby.

type Variant = 'desktop' | 'mobile'

const inputStyles: Record<Variant, string> = {
  desktop: 'h-10 rounded-[3px] px-3',
  mobile: 'h-[50px] rounded-[10px] bg-surface-card px-4',
}

const fieldClasses =
  'w-full border border-border bg-transparent text-body-sm text-foreground placeholder:text-secondary focus:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-accent aria-invalid:border-destructive'

export function FieldLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor: string
  required?: boolean
  children: string
}) {
  return (
    <label htmlFor={htmlFor} className="flex h-[29px] items-center text-body leading-[15px]">
      {children}
      {/* O "obrigatório" chega ao leitor de tela pelo required do campo. */}
      {required && (
        <span
          aria-hidden="true"
          className="w-3.5 text-center text-[22px] leading-[29px] text-required"
        >
          *
        </span>
      )}
    </label>
  )
}

function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null
  return (
    <span id={id} className="mt-1 text-caption text-destructive">
      {error}
    </span>
  )
}

// aria-describedby junta a dica (se houver) e o erro.
function describedBy(id: string, error?: string, hint?: string) {
  const ids = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean)
  return ids.length > 0 ? ids.join(' ') : undefined
}

interface FieldProps {
  id: string
  label: string
  error?: string
  hint?: string
  variant: Variant
  className?: string
}

function FieldShell({
  id,
  label,
  error,
  hint,
  required,
  className,
  children,
}: Omit<FieldProps, 'variant'> & { required?: boolean; children: ReactNode }) {
  return (
    <div className={cn('flex min-w-0 flex-col', className)}>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      {children}
      {hint && (
        <span id={`${id}-hint`} className="mt-1 text-caption text-text-secondary">
          {hint}
        </span>
      )}
      <FieldError id={`${id}-error`} error={error} />
    </div>
  )
}

export function FormField({
  id,
  label,
  error,
  hint,
  variant,
  required,
  className,
  ...props
}: FieldProps & Omit<ComponentProps<'input'>, 'id'>) {
  return (
    <FieldShell
      id={id}
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={className}
    >
      <input
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={cn(fieldClasses, inputStyles[variant])}
        {...props}
      />
    </FieldShell>
  )
}

export function PasswordField({
  id,
  label,
  error,
  hint,
  variant,
  required,
  className,
  ...props
}: FieldProps & Omit<ComponentProps<'input'>, 'id' | 'type'>) {
  const [visible, setVisible] = useState(false)
  return (
    <FieldShell
      id={id}
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={className}
    >
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          className={cn(fieldClasses, inputStyles[variant], 'pr-12')}
          {...props}
        />
        <button
          type="button"
          aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
          className="absolute top-1/2 right-3 grid size-7 -translate-y-1/2 place-items-center text-secondary hover:text-text-accent"
        >
          {visible ? (
            <Eye aria-hidden="true" className="size-[18px]" />
          ) : (
            <EyeOff aria-hidden="true" className="size-[18px]" />
          )}
        </button>
      </div>
    </FieldShell>
  )
}

export function FormSelect({
  id,
  label,
  error,
  variant,
  required,
  className,
  children,
  ...props
}: FieldProps & Omit<ComponentProps<'select'>, 'id'>) {
  return (
    <FieldShell id={id} label={label} error={error} required={required} className={className}>
      <div className="relative">
        <select
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error)}
          className={cn(
            fieldClasses,
            inputStyles[variant],
            'cursor-pointer appearance-none pr-10 text-secondary [&:has(option:checked:not([value=""]))]:text-foreground',
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          strokeWidth={1.5}
          className="pointer-events-none absolute top-1/2 right-3 size-[18px] -translate-y-1/2 text-foreground"
        />
      </div>
    </FieldShell>
  )
}

// Nome ENS como no Figma: o nome num campo e o ".eth" fixo ao lado (único domínio aceito).
export function EnsField({
  id,
  label,
  error,
  variant,
  className,
  ...props
}: FieldProps & Omit<ComponentProps<'input'>, 'id'>) {
  const hintId = `${id}-suffix`
  return (
    <div className={cn('flex min-w-0 flex-col', className)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex gap-2.5">
        <span
          id={hintId}
          className={cn(
            'flex shrink-0 items-center border border-border text-body text-foreground',
            variant === 'desktop'
              ? 'h-10 w-[78px] rounded-[3px] pl-3'
              : 'h-[50px] rounded-[10px] bg-surface-card px-4',
          )}
        >
          .eth
        </span>
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, error && `${id}-error`].filter(Boolean).join(' ')}
          className={cn(fieldClasses, inputStyles[variant])}
          {...props}
        />
      </div>
      <FieldError id={`${id}-error`} error={error} />
    </div>
  )
}

export function FormTextarea({
  id,
  label,
  error,
  variant,
  className,
  ...props
}: FieldProps & Omit<ComponentProps<'textarea'>, 'id'>) {
  const errorId = `${id}-error`
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <label htmlFor={id} className="text-body leading-[15px]">
        {label}
      </label>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          fieldClasses,
          'resize-none p-3',
          variant === 'desktop' ? 'h-[152px] rounded-[3px]' : 'h-28 rounded-[10px] bg-surface-card',
        )}
        {...props}
      />
      {error && (
        <span id={errorId} className="text-caption text-destructive">
          {error}
        </span>
      )}
    </div>
  )
}
