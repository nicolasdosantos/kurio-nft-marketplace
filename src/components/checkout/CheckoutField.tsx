import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

interface CheckoutFieldProps extends ComponentProps<'input'> {
  id: string
  label: string
  error?: string
  variant: 'desktop' | 'mobile'
}

const inputStyles = {
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

export function CheckoutField({
  id,
  label,
  error,
  variant,
  required,
  className,
  ...props
}: CheckoutFieldProps) {
  const errorId = `${id}-error`
  return (
    <div className={cn('flex min-w-0 flex-col', className)}>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <input
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(fieldClasses, inputStyles[variant])}
        {...props}
      />
      {error && (
        <span id={errorId} className="mt-1 text-caption text-destructive">
          {error}
        </span>
      )}
    </div>
  )
}

export function CheckoutTextarea({
  id,
  label,
  error,
  variant,
  className,
  ...props
}: Omit<ComponentProps<'textarea'>, 'id'> & {
  id: string
  label: string
  error?: string
  variant: 'desktop' | 'mobile'
}) {
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
