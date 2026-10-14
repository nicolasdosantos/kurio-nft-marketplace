import { createFileRoute } from '@tanstack/react-router'
import { catalogSearchSchema, type CatalogSearch } from '@/lib/catalog-search'
import { CatalogPage } from '@/pages/CatalogPage'

export const Route = createFileRoute('/')({
  validateSearch: (search) => catalogSearchSchema.parse(search),
  component: CatalogRoute,
})

function CatalogRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  function handleFiltersChange(changes: Partial<CatalogSearch>) {
    navigate({ search: (previous) => ({ ...previous, ...changes, page: undefined }) })
  }

  function handlePageChange(page: number) {
    navigate({ search: (previous) => ({ ...previous, page: page > 1 ? page : undefined }) })
  }

  return (
    <CatalogPage
      search={search}
      onFiltersChange={handleFiltersChange}
      onPageChange={handlePageChange}
    />
  )
}
