import type { NftTab } from '@/api/contracts/nfts'
import { sortOptions, type CatalogSearch } from '@/lib/catalog-search'

const tabs: { id: NftTab; label: string }[] = [
  { id: 'all', label: 'Todos os NFTs' },
  { id: 'new', label: 'Novos lançamentos' },
  { id: 'trending', label: 'Em alta' },
]

interface CatalogToolbarProps {
  search: CatalogSearch
  onFiltersChange: (changes: Partial<CatalogSearch>) => void
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

// Enquanto o Select do Radix carrega: mesmo texto e mesmo tamanho, sem pular.
export function SortSelectPlaceholder({ search }: { search: CatalogSearch }) {
  const activeSort = sortOptions.find((option) => option.id === (search.sort ?? 'recent'))

  return (
    <div aria-hidden="true" className="flex h-8 items-center gap-2 text-body text-foreground">
      <span>Ordenar por:</span>
      <span className="flex items-center gap-2">
        {activeSort?.label}
        <img src="/icons/arrow-down.svg" alt="" width={11} height={6} />
      </span>
    </div>
  )
}
