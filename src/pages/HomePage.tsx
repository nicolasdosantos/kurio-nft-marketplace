import { lazy, Suspense, useRef, useState, type FormEvent, type CSSProperties } from 'react'
import { useNftList } from '@/api/catalog'
import { CatalogPagination } from '@/components/catalog/CatalogPagination'
import { CatalogTabs, SortSelectPlaceholder } from '@/components/catalog/CatalogToolbar'
import { NftCard, NftCardSkeleton } from '@/components/catalog/NftCard'
import { BlogSection } from '@/components/home/BlogSection'
import { FeaturedBanner } from '@/components/home/FeaturedBanner'
import { HomeHero, MobileHeroBanner } from '@/components/home/HomeHero'
import { PromoCards } from '@/components/home/PromoCards'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CATALOG_PAGE_SIZE, toNftListParams, type CatalogSearch } from '@/lib/catalog-search'
import { useIsDesktop, useMediaQuery } from '@/lib/use-media-query'

// Filtros, ordenação e o Sheet usam os componentes mais pesados do Radix e não
// fazem parte da primeira tela no mobile: carregam sob demanda.
const CatalogFilters = lazy(() =>
  import('@/components/catalog/CatalogFilters').then((module) => ({
    default: module.CatalogFilters,
  })),
)
const SortSelect = lazy(() =>
  import('@/components/catalog/SortSelect').then((module) => ({ default: module.SortSelect })),
)
const FiltersSheet = lazy(() =>
  import('@/components/catalog/FiltersSheet').then((module) => ({
    default: module.FiltersSheet,
  })),
)

function FiltersSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: 12 }, (_, index) => (
        <Skeleton key={index} className="h-6" />
      ))}
    </div>
  )
}

interface HomePageProps {
  search: CatalogSearch
  // Qualquer mudança de filtro volta para a página 1 (quem chama cuida disso).
  onFiltersChange: (changes: Partial<CatalogSearch>) => void
}

function MobileSearchForm({
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
    <form
      role="search"
      onSubmit={handleSubmit}
      className="flex h-[45px] flex-1 items-center gap-2 rounded-[10px] bg-surface-card px-3 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-text-accent"
    >
      <img src="/icons/mobile-search.svg" alt="" width={22} height={22} />
      <label htmlFor="mobile-search" className="sr-only">
        Buscar NFTs
      </label>
      <input
        id="mobile-search"
        type="search"
        value={searchText}
        onChange={(event) => setSearchText(event.target.value)}
        placeholder="Explorar coleções"
        className="min-w-0 flex-1 bg-transparent text-body-sm font-bold text-foreground placeholder:text-secondary focus-visible:outline-none"
      />
    </form>
  )
}

export function HomePage({ search, onFiltersChange }: HomePageProps) {
  const listQuery = useNftList(toNftListParams(search))
  const [filtersOpen, setFiltersOpen] = useState(false)
  // O Sheet só é baixado na primeira vez que alguém abre os filtros.
  const [filtersRequested, setFiltersRequested] = useState(false)
  const filtersOpener = useRef<HTMLButtonElement | null>(null)
  const facets = listQuery.data?.facets
  const isTabletUp = useMediaQuery('(min-width: 768px)')
  const isDesktop = useIsDesktop()

  const filtersButton = (
    <button
      type="button"
      aria-label="Abrir filtros"
      onClick={(event) => {
        filtersOpener.current = event.currentTarget
        setFiltersRequested(true)
        setFiltersOpen(true)
      }}
      className="grid size-[45px] shrink-0 place-items-center rounded-[14px] bg-[linear-gradient(137deg,rgba(210,138,76,0.45)_25%,var(--color-primary)_100%)] lg:hidden"
    >
      <img src="/icons/mobile-filter.svg" alt="" width={16} height={16} />
    </button>
  )

  return (
    <main className="mx-auto flex w-full max-w-[1232px] flex-col gap-4 px-6 pt-10 md:gap-24 md:px-4 md:pt-8">
      <div className="flex gap-2 md:hidden">
        <MobileSearchForm
          key={search.q ?? ''}
          initialText={search.q ?? ''}
          onSubmit={(text) => onFiltersChange({ q: text || undefined })}
        />
        {filtersButton}
      </div>

      {/* Só o hero do layout atual vai para a página: o escondido baixaria as imagens à toa. */}
      {isTabletUp ? <HomeHero /> : <MobileHeroBanner />}

      <div id="catalogo" className="flex scroll-mt-6 gap-12">
        {isDesktop && (
          <aside aria-label="Filtros" className="flex w-[310px] shrink-0 flex-col gap-6">
            <div className="bg-surface-card p-5">
              <Suspense fallback={<FiltersSkeleton />}>
                <CatalogFilters
                  idPrefix="sidebar"
                  search={search}
                  facets={facets}
                  onFiltersChange={onFiltersChange}
                />
              </Suspense>
            </div>
            <FeaturedBanner />
          </aside>
        )}

        <section
          aria-labelledby="catalog-title"
          className="flex min-w-0 flex-1 flex-col gap-4 md:gap-8"
        >
          {/* Título da seção para leitor de tela: os cards são h3 e precisam de um h2 antes. */}
          <h2 id="catalog-title" className="sr-only">
            Catálogo de NFTs
          </h2>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <CatalogTabs search={search} onFiltersChange={onFiltersChange} />
            {isTabletUp && (
              <div className="flex items-center gap-4">
                {filtersButton}
                <Suspense fallback={<SortSelectPlaceholder search={search} />}>
                  <SortSelect
                    idPrefix="toolbar"
                    search={search}
                    onFiltersChange={onFiltersChange}
                  />
                </Suspense>
              </div>
            )}
          </div>

          <p role="status" className="sr-only" data-testid="catalog-total">
            {listQuery.data &&
              `${listQuery.data.total} ${listQuery.data.total === 1 ? 'resultado' : 'resultados'}`}
          </p>

          {listQuery.isPending && (
            <ul
              aria-label="Carregando NFTs"
              className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 md:gap-x-[34px] md:gap-y-[72px]"
            >
              {Array.from({ length: CATALOG_PAGE_SIZE }, (_, index) => (
                <li
                  key={index}
                  data-testid="nft-card-skeleton"
                  className="even:translate-y-8 md:even:translate-y-0"
                >
                  <NftCardSkeleton />
                </li>
              ))}
            </ul>
          )}

          {listQuery.isError && (
            <div
              role="alert"
              className="flex flex-col items-start gap-3 rounded-lg bg-surface-card p-6"
            >
              <p className="text-body-md font-bold text-foreground">
                Não foi possível carregar os NFTs.
              </p>
              <p className="text-body-sm text-text-secondary">{listQuery.error.message}</p>
              <Button onClick={() => listQuery.refetch()}>Tentar de novo</Button>
            </div>
          )}

          {listQuery.data && listQuery.data.items.length === 0 && (
            <div className="flex flex-col items-start gap-3 rounded-lg bg-surface-card p-6">
              <p className="text-body-md font-bold text-foreground">Nenhum NFT encontrado.</p>
              <p className="text-body-sm text-text-secondary">
                Tente outra busca ou remova alguns filtros.
              </p>
            </div>
          )}

          {listQuery.data && listQuery.data.items.length > 0 && (
            <>
              <ul
                data-testid="catalog-results"
                aria-busy={listQuery.isFetching}
                className="grid grid-cols-2 gap-x-4 gap-y-6 pb-8 md:grid-cols-3 md:gap-x-[34px] md:gap-y-[72px] md:pb-0"
              >
                {listQuery.data.items.map((nft, index) => (
                  <li
                    key={nft.id}
                    style={{ '--stagger': index } as CSSProperties}
                    className="rise-in even:translate-y-8 md:even:translate-y-0"
                  >
                    <NftCard nft={nft} />
                  </li>
                ))}
              </ul>
              <div className="flex justify-center md:mt-14 md:justify-end">
                <CatalogPagination
                  currentPage={search.page ?? 1}
                  totalPages={listQuery.data.totalPages}
                />
              </div>
            </>
          )}
        </section>
      </div>

      <PromoCards />
      <BlogSection />

      {filtersRequested && (
        <Suspense>
          <FiltersSheet
            open={filtersOpen}
            onOpenChange={setFiltersOpen}
            opener={filtersOpener}
            search={search}
            facets={facets}
            onFiltersChange={onFiltersChange}
          />
        </Suspense>
      )}
    </main>
  )
}
