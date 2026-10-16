import type { FieldValues, Path, UseFormReturn } from 'react-hook-form'

// Erros de campo da API (409/422) aparecem no campo certo, com foco no primeiro deles.
// O fieldset ainda está desabilitado enquanto a mutation termina: o foco vai no próximo frame.
export function showFieldErrors<Form extends FieldValues>(
  form: Pick<UseFormReturn<Form>, 'setError' | 'setFocus'>,
  fields: Record<string, string>,
  // Nome do campo na API -> nome no formulário (ex.: ensName -> ensLabel).
  rename: Record<string, string> = {},
) {
  const names = Object.entries(fields).map(([field, message]) => {
    const name = (rename[field] ?? field) as Path<Form>
    form.setError(name, { message })
    return name
  })
  const [first] = names
  if (first) requestAnimationFrame(() => form.setFocus(first))
}
