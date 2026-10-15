import { Link } from '@tanstack/react-router'
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination'
import { cn } from '@/lib/utils'

const pageBoxClasses =
  'grid size-[35px] place-items-center rounded-[4px] border border-border text-body-lg text-foreground hover:border-primary'

interface CatalogPaginationProps {
  currentPage: number
  totalPages: number
}

// Links de verdade (e não botões) para a página poder ser aberta numa aba nova e voltar pelo histórico.
export function CatalogPagination({ currentPage, totalPages }: CatalogPaginationProps) {
  if (totalPages <= 1) return null

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1)
  const searchForPage = (page: number) => (previous: Record<string, unknown>) => ({
    ...previous,
    page: page > 1 ? page : undefined,
  })

  return (
    <Pagination aria-label="Paginação" className="mx-0 w-auto justify-end">
      <PaginationContent className="gap-2">
        {currentPage > 1 && (
          <PaginationItem>
            <Link
              to="/"
              search={searchForPage(currentPage - 1)}
              aria-label="Página anterior"
              className={cn(pageBoxClasses, 'p-2')}
            >
              <img
                src="/icons/arrow-right-small.svg"
                alt=""
                width={12}
                height={7}
                className="rotate-90"
              />
            </Link>
          </PaginationItem>
        )}
        {pages.map((page) => (
          <PaginationItem key={page}>
            <Link
              to="/"
              search={searchForPage(page)}
              aria-label={`Página ${page}`}
              aria-current={page === currentPage ? 'page' : undefined}
              className={cn(
                pageBoxClasses,
                page === currentPage && 'border-primary bg-primary font-bold text-ink',
              )}
            >
              {page}
            </Link>
          </PaginationItem>
        ))}
        {currentPage < totalPages && (
          <PaginationItem>
            <Link
              to="/"
              search={searchForPage(currentPage + 1)}
              aria-label="Próxima página"
              className={cn(pageBoxClasses, 'p-2')}
            >
              <img
                src="/icons/arrow-right-small.svg"
                alt=""
                width={12}
                height={7}
                className="-rotate-90"
              />
            </Link>
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  )
}
