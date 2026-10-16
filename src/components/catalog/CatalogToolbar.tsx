import { useLayoutEffect, useRef, useState } from 'react'
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
  const tabRefs = useRef(new Map<NftTab, HTMLButtonElement>())
  const [underline, setUnderline] = useState<{ x: number; width: number } | null>(null)

  // Um sublinhado só, que desliza até a aba ativa. Só transform (translate e scale):
  // nada em volta muda de lugar. A posição é medida de novo quando a fonte carrega ou a
  // largura muda.
  useLayoutEffect(() => {
    const measure = () => {
      const tab = tabRefs.current.get(activeTab)
      if (tab) setUnderline({ x: tab.offsetLeft, width: tab.offsetWidth })
    }
    measure()
    const observer = new ResizeObserver(measure)
    tabRefs.current.forEach((tab) => observer.observe(tab))
    return () => observer.disconnect()
  }, [activeTab])

  return (
    <div
      role="group"
      aria-label="Abas do catálogo"
      // Sem quebra de linha: com a fonte reserva (mais larga) as abas quebrariam e a grade pularia.
      className="relative -mx-6 flex gap-x-3 overflow-x-auto px-6 pb-[6px] text-body-sm md:mx-0 md:gap-x-5 md:overflow-visible md:px-0 md:pb-[9px] md:text-body"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          ref={(element) => {
            if (element) tabRefs.current.set(tab.id, element)
          }}
          type="button"
          aria-pressed={tab.id === activeTab}
          onClick={() => onFiltersChange({ tab: tab.id === 'all' ? undefined : tab.id })}
          className="leading-4 whitespace-nowrap text-foreground aria-pressed:font-bold aria-pressed:text-text-accent md:font-medium"
        >
          {tab.label}
        </button>
      ))}
      {underline && (
        <span
          aria-hidden="true"
          style={{ transform: `translateX(${underline.x}px) scaleX(${underline.width})` }}
          className="pointer-events-none absolute bottom-0 left-0 h-0.5 w-px origin-left bg-primary motion-safe:transition-transform motion-safe:duration-[380ms] motion-safe:ease-(--ease-out-soft)"
        />
      )}
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
