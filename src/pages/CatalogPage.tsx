import { useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { useNftList } from '@/api/catalog'
import type { Network } from '@/api/contracts/common'
import type { NftSort, NftTab } from '@/api/contracts/nfts'
import { toNftListParams, type CatalogSearch } from '@/lib/catalog-search'

const tabs: { id: NftTab; label: string }[] = [
  { id: 'all', label: 'Todos os NFTs' },
  { id: 'new', label: 'Novos lançamentos' },
  { id: 'trending', label: 'Em alta' },
]

const sortOptions: { id: NftSort; label: string }[] = [
  { id: 'recent', label: 'Listados recentemente' },
  { id: 'price-asc', label: 'Menor preço' },
  { id: 'price-desc', label: 'Maior preço' },
  { id: 'name', label: 'Nome' },
]

const networkLabels: Record<Network, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  solana: 'Solana',
}

interface CatalogPageProps {
  search: CatalogSearch
  // Qualquer mudança de filtro volta para a página 1; só a paginação muda a página.
  onFiltersChange: (changes: Partial<CatalogSearch>) => void
  onPageChange: (page: number) => void
}

function toggleValue<Value>(list: Value[] | undefined, value: Value) {
  const current = list ?? []
  const next = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value]
  return next.length > 0 ? next : undefined
}

export function CatalogPage({ search, onFiltersChange, onPageChange }: CatalogPageProps) {
  const listQuery = useNftList(toNftListParams(search))
  const facets = listQuery.data?.facets
  const currentPage = search.page ?? 1

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-4">
      <h1 className="text-heading font-bold">Mercado</h1>

      <SearchForm
        key={search.q ?? ''}
        initialText={search.q ?? ''}
        onSubmit={(text) => onFiltersChange({ q: text || undefined })}
      />

      <div className="grid gap-6 md:grid-cols-[14rem_1fr]">
        <aside className="flex flex-col gap-4" aria-label="Filtros">
          <fieldset>
            <legend className="font-bold">Coleções</legend>
            {facets?.collections.map((collection) => (
              <label key={collection.slug} className="flex gap-2">
                <input
                  type="checkbox"
                  checked={search.collections?.includes(collection.slug) ?? false}
                  onChange={() =>
                    onFiltersChange({
                      collections: toggleValue(search.collections, collection.slug),
                    })
                  }
                />
                {collection.name} ({collection.count})
              </label>
            ))}
          </fieldset>

          <PriceRangeForm
            key={`${search.minPrice}-${search.maxPrice}`}
            initialMin={search.minPrice ?? ''}
            initialMax={search.maxPrice ?? ''}
            onSubmit={(minPrice, maxPrice) =>
              onFiltersChange({ minPrice: minPrice || undefined, maxPrice: maxPrice || undefined })
            }
          />

          <fieldset>
            <legend className="font-bold">Rede</legend>
            {facets?.networks.map((network) => (
              <label key={network.id} className="flex gap-2">
                <input
                  type="checkbox"
                  checked={search.networks?.includes(network.id) ?? false}
                  onChange={() =>
                    onFiltersChange({ networks: toggleValue(search.networks, network.id) })
                  }
                />
                {networkLabels[network.id]} ({network.count})
              </label>
            ))}
          </fieldset>
        </aside>

        <section aria-label="Resultados" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div role="tablist" aria-label="Abas do catálogo" className="flex gap-3">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  type="button"
                  aria-selected={(search.tab ?? 'all') === tab.id}
                  onClick={() => onFiltersChange({ tab: tab.id === 'all' ? undefined : tab.id })}
                  className="aria-selected:text-text-accent aria-selected:underline"
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <label className="flex gap-2">
              Ordenar por
              <select
                value={search.sort ?? 'recent'}
                onChange={(event) => {
                  const sort = event.target.value as NftSort
                  onFiltersChange({ sort: sort === 'recent' ? undefined : sort })
                }}
                className="rounded border border-input bg-ink"
              >
                {sortOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {listQuery.isPending && <p>Carregando NFTs...</p>}
          {listQuery.isError && (
            <div role="alert">
              <p>{listQuery.error.message}</p>
              <button type="button" onClick={() => listQuery.refetch()} className="underline">
                Tentar de novo
              </button>
            </div>
          )}
          {listQuery.data && listQuery.data.items.length === 0 && (
            <p>Nenhum NFT encontrado com esses filtros.</p>
          )}

          {listQuery.data && listQuery.data.items.length > 0 && (
            <>
              <p className="text-body-sm text-text-secondary" data-testid="catalog-total">
                {listQuery.data.total} resultados
                {listQuery.isFetching && ' · atualizando...'}
              </p>
              <ul data-testid="catalog-results" className="grid gap-3 sm:grid-cols-3">
                {listQuery.data.items.map((nft) => (
                  <li key={nft.id} className="rounded border border-border bg-surface-card p-2">
                    <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="font-bold">
                      {nft.name}
                    </Link>
                    <p className="text-text-accent">
                      {nft.priceEth} ETH
                      {nft.originalPriceEth && (
                        <s className="ml-2 text-text-secondary">{nft.originalPriceEth} ETH</s>
                      )}
                    </p>
                  </li>
                ))}
              </ul>

              <nav aria-label="Paginação" className="flex gap-2">
                {Array.from({ length: listQuery.data.totalPages }, (_, index) => index + 1).map(
                  (pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      aria-current={pageNumber === currentPage ? 'page' : undefined}
                      onClick={() => onPageChange(pageNumber)}
                      className="min-w-8 rounded border border-border aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
                    >
                      {pageNumber}
                    </button>
                  ),
                )}
              </nav>
            </>
          )}
        </section>
      </div>
    </main>
  )
}

// Os campos de texto guardam o que está sendo digitado; o "key" no pai reinicia
// o valor quando a URL muda (ex.: voltar no histórico).
function SearchForm({
  initialText,
  onSubmit,
}: {
  initialText: string
  onSubmit: (text: string) => void
}) {
  const [searchText, setSearchText] = useState(initialText)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSubmit(searchText.trim())
  }

  return (
    <form role="search" onSubmit={handleSubmit} className="flex gap-2">
      <label htmlFor="catalog-search" className="sr-only">
        Buscar NFTs
      </label>
      <input
        id="catalog-search"
        type="search"
        value={searchText}
        onChange={(event) => setSearchText(event.target.value)}
        placeholder="Buscar por nome ou coleção"
        className="flex-1 rounded border border-input bg-ink p-2"
      />
      <button type="submit" className="rounded bg-primary px-3 text-primary-foreground">
        Buscar
      </button>
    </form>
  )
}

function PriceRangeForm({
  initialMin,
  initialMax,
  onSubmit,
}: {
  initialMin: string
  initialMax: string
  onSubmit: (minPrice: string, maxPrice: string) => void
}) {
  const [minPrice, setMinPrice] = useState(initialMin)
  const [maxPrice, setMaxPrice] = useState(initialMax)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSubmit(minPrice.trim(), maxPrice.trim())
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1">
      <span className="font-bold">Faixa de preço (ETH)</span>
      <label htmlFor="min-price">Mínimo</label>
      <input
        id="min-price"
        inputMode="decimal"
        value={minPrice}
        onChange={(event) => setMinPrice(event.target.value)}
        className="rounded border border-input bg-ink p-1"
      />
      <label htmlFor="max-price">Máximo</label>
      <input
        id="max-price"
        inputMode="decimal"
        value={maxPrice}
        onChange={(event) => setMaxPrice(event.target.value)}
        className="rounded border border-input bg-ink p-1"
      />
      <button type="submit" className="mt-1 rounded bg-primary p-1 text-primary-foreground">
        Aplicar
      </button>
    </form>
  )
}
