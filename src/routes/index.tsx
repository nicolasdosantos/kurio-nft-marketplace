import { createFileRoute } from '@tanstack/react-router'
import { catalogSearchSchema, type CatalogSearch } from '@/lib/catalog-search'
import { HomePage } from '@/pages/HomePage'

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

  return <HomePage search={search} onFiltersChange={handleFiltersChange} />
}
