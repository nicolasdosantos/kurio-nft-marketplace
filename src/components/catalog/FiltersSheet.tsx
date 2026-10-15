import type { RefObject } from 'react'
import type { NftListResponse } from '@/api/contracts/nfts'
import { CatalogFilters } from '@/components/catalog/CatalogFilters'
import { SortSelect } from '@/components/catalog/SortSelect'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { CatalogSearch } from '@/lib/catalog-search'

interface FiltersSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  opener: RefObject<HTMLButtonElement | null>
  search: CatalogSearch
  facets: NftListResponse['facets'] | undefined
  onFiltersChange: (changes: Partial<CatalogSearch>) => void
}

// Um Sheet só, aberto pelo botão do mobile ou do tablet (no desktop a sidebar fica visível).
export function FiltersSheet({
  open,
  onOpenChange,
  opener,
  search,
  facets,
  onFiltersChange,
}: FiltersSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-[330px] overflow-y-auto border-border-soft bg-surface-card p-5"
        onCloseAutoFocus={(event) => {
          // Sem SheetTrigger o Radix não sabe para onde voltar o foco.
          event.preventDefault()
          opener.current?.focus()
        }}
      >
        <SheetHeader className="p-0">
          <SheetTitle className="text-heading text-foreground">Filtros</SheetTitle>
          <SheetDescription className="text-text-secondary">
            Os resultados atualizam a cada filtro escolhido.
          </SheetDescription>
        </SheetHeader>
        <div className="md:hidden">
          <SortSelect idPrefix="sheet" search={search} onFiltersChange={onFiltersChange} />
        </div>
        <CatalogFilters
          idPrefix="sheet"
          search={search}
          facets={facets}
          onFiltersChange={onFiltersChange}
        />
      </SheetContent>
    </Sheet>
  )
}
