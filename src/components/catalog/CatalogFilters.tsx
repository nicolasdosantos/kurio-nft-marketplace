import { useState } from 'react'
import type { Network } from '@/api/contracts/common'
import type { NftListResponse } from '@/api/contracts/nfts'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import type { CatalogSearch } from '@/lib/catalog-search'
import { formatEthWithComma, networkLabels } from '@/lib/display'
import { cn } from '@/lib/utils'

interface CatalogFiltersProps {
  search: CatalogSearch
  facets: NftListResponse['facets'] | undefined
  onFiltersChange: (changes: Partial<CatalogSearch>) => void
  idPrefix: string
}

function toggleValue<Value>(list: Value[] | undefined, value: Value) {
  const current = list ?? []
  const next = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value]
  return next.length > 0 ? next : undefined
}

function FilterRow({
  id,
  label,
  count,
  checked,
  onToggle,
}: {
  id: string
  label: string
  count: number
  checked: boolean
  onToggle: () => void
}) {
  return (
    <li
      className={cn(
        'flex items-center justify-between text-body leading-10',
        checked ? 'text-text-accent' : 'text-text-secondary',
      )}
    >
      <label htmlFor={id} className="flex cursor-pointer items-center gap-2">
        <Checkbox id={id} checked={checked} onCheckedChange={onToggle} />
        {label}
        <span className="sr-only">, {count} NFTs</span>
      </label>
      <span className="font-bold" aria-hidden="true">
        ({count})
      </span>
    </li>
  )
}

function PriceRangeFilter({
  search,
  priceRange,
  onFiltersChange,
}: {
  search: CatalogSearch
  priceRange: { min: string; max: string }
  onFiltersChange: CatalogFiltersProps['onFiltersChange']
}) {
  const rangeMin = Number(priceRange.min)
  const rangeMax = Number(priceRange.max)
  const [selectedRange, setSelectedRange] = useState([
    Number(search.minPrice ?? rangeMin),
    Number(search.maxPrice ?? rangeMax),
  ])
  const [selectedMin = rangeMin, selectedMax = rangeMax] = selectedRange

  function handleApply() {
    onFiltersChange({
      minPrice: selectedMin > rangeMin ? selectedMin.toFixed(2) : undefined,
      maxPrice: selectedMax < rangeMax ? selectedMax.toFixed(2) : undefined,
    })
  }

  return (
    <div className="flex flex-col gap-3 pl-3">
      <Slider
        min={rangeMin}
        max={rangeMax}
        step={0.01}
        value={selectedRange}
        onValueChange={setSelectedRange}
        thumbLabels={['Preço mínimo', 'Preço máximo']}
        className="py-2"
      />
      <p className="text-body text-foreground" aria-live="polite">
        Preço: {formatEthWithComma(selectedMin.toFixed(2))} -{' '}
        {formatEthWithComma(selectedMax.toFixed(2))} ETH
      </p>
      <Button size="sm" className="self-start px-3" onClick={handleApply}>
        Aplicar
      </Button>
    </div>
  )
}

export function CatalogFilters({ search, facets, onFiltersChange, idPrefix }: CatalogFiltersProps) {
  if (!facets) {
    return (
      <div className="flex flex-col gap-3" aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => (
          <Skeleton key={index} className="h-6" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-10">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-body-lg font-bold text-foreground">Coleções</legend>
        <ul className="px-3">
          {facets.collections.map((collection) => (
            <FilterRow
              key={collection.slug}
              id={`${idPrefix}-collection-${collection.slug}`}
              label={collection.name}
              count={collection.count}
              checked={search.collections?.includes(collection.slug) ?? false}
              onToggle={() =>
                onFiltersChange({ collections: toggleValue(search.collections, collection.slug) })
              }
            />
          ))}
        </ul>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-body-lg font-bold text-foreground">Faixa de preço</legend>
        <PriceRangeFilter
          key={`${search.minPrice}-${search.maxPrice}`}
          search={search}
          priceRange={facets.priceRange}
          onFiltersChange={onFiltersChange}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-body-lg font-bold text-foreground">Rede</legend>
        <ul className="pl-3">
          {facets.networks.map((network) => (
            <FilterRow
              key={network.id}
              id={`${idPrefix}-network-${network.id}`}
              label={networkLabels[network.id as Network]}
              count={network.count}
              checked={search.networks?.includes(network.id) ?? false}
              onToggle={() =>
                onFiltersChange({ networks: toggleValue(search.networks, network.id) })
              }
            />
          ))}
        </ul>
      </fieldset>
    </div>
  )
}
