import type { Edition, EditionId } from '@/api/contracts/nfts'

function availableText(stock: number) {
  return `${stock} ${stock === 1 ? 'disponível' : 'disponíveis'}`
}

interface EditionPickerProps {
  editions: Edition[]
  selectedId: EditionId | null
  onSelect: (editionId: EditionId) => void
  // O mobile e o desktop têm um seletor cada; o name separa os dois grupos de rádio.
  name: string
}

// Rádios nativos com a cara dos pills do Figma: as setas do teclado trocam de edição
// e pulam sozinhas as esgotadas (desabilitadas).
export function EditionPicker({ editions, selectedId, onSelect, name }: EditionPickerProps) {
  const selected = editions.find((edition) => edition.id === selectedId)

  return (
    <fieldset>
      <legend className="mb-2 text-body leading-4 font-bold text-foreground md:mb-3">
        Edição:
      </legend>
      <div className="flex flex-wrap gap-3 md:gap-1.5">
        {editions.map((edition) => {
          const soldOut = edition.stock === 0
          return (
            <label key={edition.id}>
              <input
                type="radio"
                name={name}
                value={edition.id}
                checked={edition.id === selectedId}
                disabled={soldOut}
                onChange={() => onSelect(edition.id)}
                className="peer sr-only"
              />
              <span className="flex h-7 cursor-pointer items-center rounded-full border border-border px-1.5 text-body-sm leading-4 text-text-secondary uppercase peer-checked:border-primary peer-checked:font-medium peer-checked:text-text-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-text-accent peer-disabled:cursor-not-allowed peer-disabled:line-through peer-disabled:opacity-50">
                {edition.label}
              </span>
              <span className="sr-only">
                {soldOut ? ', esgotada' : `, ${availableText(edition.stock)}`}
              </span>
            </label>
          )
        })}
      </div>
      <p className="mt-2 text-caption text-text-secondary" data-testid="edition-stock">
        {selected
          ? `${availableText(selected.stock)} · até ${selected.maxPerOrder} por pedido`
          : 'Todas as edições estão esgotadas.'}
      </p>
    </fieldset>
  )
}
