import type { NftSort, NftTab } from '@/api/contracts/nfts'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CatalogSearch } from '@/lib/catalog-search'

const tabs: { id: NftTab; label: string }[] = [
  { id: 'all', label: 'Todos os NFTs' },
  { id: 'new', label: 'Novos lançamentos' },
  { id: 'trending', label: 'Em alta' },
]

const sortOptions: { id: NftSort; label: string }[] = [
  { id: 'recent', label: 'Listados recentemente' },
  { id: 'price-asc', label: 'Menor preço' },
  { id: 'price-desc', label: 'Maior preço' },
  { id: 'name', label: 'Nome (A-Z)' },
]

interface CatalogToolbarProps {
  search: CatalogSearch
  onFiltersChange: (changes: Partial<CatalogSearch>) => void
}

interface SortSelectProps extends CatalogToolbarProps {
  idPrefix: string
}

export function CatalogTabs({ search, onFiltersChange }: CatalogToolbarProps) {
  const activeTab = search.tab ?? 'all'

  return (
    <div
      role="group"
      aria-label="Abas do catálogo"
      // Sem quebra de linha: com a fonte reserva (mais larga) as abas quebrariam e a grade pularia.
      className="-mx-6 flex gap-x-3 overflow-x-auto px-6 text-body-sm md:mx-0 md:gap-x-5 md:overflow-visible md:px-0 md:text-body"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeTab
        return (
          <button
            key={tab.id}
            type="button"
            aria-pressed={active}
            onClick={() => onFiltersChange({ tab: tab.id === 'all' ? undefined : tab.id })}
            className="flex flex-col gap-1 leading-4 whitespace-nowrap text-foreground aria-pressed:font-bold aria-pressed:text-text-accent md:gap-[7px] md:font-medium"
          >
            {tab.label}
            <img
              src="/icons/tab-underline.svg"
              alt=""
              className={active ? 'h-0.5 w-full' : 'invisible h-0.5 w-full'}
            />
          </button>
        )
      })}
    </div>
  )
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
