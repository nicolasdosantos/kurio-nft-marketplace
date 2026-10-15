import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useNftList } from '@/api/catalog'
import type { Nft } from '@/api/contracts/nfts'
import { Skeleton } from '@/components/ui/skeleton'
import { nftImageSources } from '@/lib/display'
import { useIsDesktop, useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'

export function RelatedNfts({ nft }: { nft: Nft }) {
  const listQuery = useNftList({ collection: [nft.collection.slug], pageSize: 12 })
  const isDesktop = useIsDesktop()
  const isTabletUp = useMediaQuery('(min-width: 768px)')
  const perPage = isDesktop ? 5 : isTabletUp ? 3 : 2
  const [page, setPage] = useState(0)

  const related = listQuery.data?.items.filter((item) => item.id !== nft.id) ?? []
  const totalPages = Math.max(1, Math.ceil(related.length / perPage))
  // Ao girar o celular o número por página muda; a página atual não pode sobrar.
  const currentPage = Math.min(page, totalPages - 1)
  const visible = related.slice(currentPage * perPage, (currentPage + 1) * perPage)

  if (listQuery.isSuccess && related.length === 0) return null

  return (
    <section aria-labelledby="related-title" className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h2 id="related-title" className="text-[17px] leading-4 font-bold text-text-accent">
          Mais desta coleção
        </h2>
        <div className="h-px bg-primary/30" />
      </div>

      <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-7 lg:grid-cols-5">
        {listQuery.isPending
          ? Array.from({ length: perPage }, (_, index) => (
              <li key={index} aria-hidden="true" className="flex flex-col gap-3">
                <Skeleton className="aspect-[219/255] rounded-none" />
                <Skeleton className="h-9 w-2/3" />
              </li>
            ))
          : visible.map((item) => (
              <li key={item.id} className="relative flex flex-col gap-3">
                <div className="grid aspect-[219/255] place-items-center bg-surface-card px-1">
                  <img
                    {...nftImageSources(item.imageUrl)}
                    sizes="(min-width: 1024px) 212px, 45vw"
                    alt={`Arte do NFT ${item.name}`}
                    width={212}
                    height={212}
                    loading="lazy"
                    decoding="async"
                    className="aspect-square w-full max-w-[212px] rounded-[13px] object-cover"
                  />
                </div>
                <div className="flex flex-col">
                  <Link
                    to="/nft/$nftId"
                    params={{ nftId: item.id }}
                    className="text-body leading-5 text-foreground after:absolute after:inset-0"
                  >
                    {item.name}
                  </Link>
                  <span className="text-body-md leading-4 font-bold text-text-accent">
                    {item.priceEth} ETH
                  </span>
                </div>
              </li>
            ))}
      </ul>

      {totalPages > 1 && (
        <div role="group" aria-label="Páginas do carrossel" className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Página ${index + 1} de ${totalPages}`}
              aria-current={index === currentPage ? 'true' : undefined}
              onClick={() => setPage(index)}
              className={cn(
                'relative size-3 rounded-full border-[1.3px] border-primary after:absolute after:-inset-2',
                index === currentPage && 'bg-primary',
              )}
            />
          ))}
        </div>
      )}
    </section>
  )
}
