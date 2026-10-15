import type { NftSort } from '@/api/contracts/nfts'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { sortOptions, type CatalogSearch } from '@/lib/catalog-search'

interface SortSelectProps {
  search: CatalogSearch
  onFiltersChange: (changes: Partial<CatalogSearch>) => void
  idPrefix: string
}

export function SortSelect({ search, onFiltersChange, idPrefix }: SortSelectProps) {
  const labelId = `${idPrefix}-sort-label`

  return (
    <div className="flex items-center gap-2 text-body text-foreground">
      <span id={labelId}>Ordenar por:</span>
      <Select
        value={search.sort ?? 'recent'}
        onValueChange={(value) => {
          const sort = value as NftSort
          onFiltersChange({ sort: sort === 'recent' ? undefined : sort })
        }}
      >
        <SelectTrigger
          aria-labelledby={labelId}
          className="h-auto gap-2 border-none bg-transparent p-0 text-body text-foreground shadow-none dark:bg-transparent [&>svg]:hidden"
        >
          <SelectValue />
          <img src="/icons/arrow-down.svg" alt="" width={11} height={6} />
        </SelectTrigger>
        <SelectContent className="border-border-soft bg-surface-card">
          {sortOptions.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
