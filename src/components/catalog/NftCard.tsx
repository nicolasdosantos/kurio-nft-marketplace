import { Link } from '@tanstack/react-router'
import type { NftSummary } from '@/api/contracts/nfts'
import { Skeleton } from '@/components/ui/skeleton'
import { networkLabels, nftImageSources } from '@/lib/display'
import { cn } from '@/lib/utils'
import { FavoriteButton } from './FavoriteButton'

// Mobile segue o card arredondado com gradiente do Figma mobile; a partir do md, o card do desktop.
const frameClasses =
  'relative flex h-[200px] items-center justify-center rounded-[20px] bg-[linear-gradient(140deg,var(--color-surface-card)_12%,var(--color-surface-raised)_107%)] p-1 md:aspect-[258/300] md:h-auto md:items-start md:rounded-none md:bg-none md:bg-surface-card md:pt-[9%]'

// O tamanho fica no contêiner da imagem, para o selo de raridade acompanhar o topo dela.
const imageBoxClasses = 'relative aspect-square w-full max-w-[168px] md:w-[97%] md:max-w-[250px]'

export function NftCard({ nft }: { nft: NftSummary }) {
  const image = nftImageSources(nft.imageUrl)

  return (
    <article className="group relative flex flex-col gap-2 md:gap-3">
      <div
        className={cn(
          frameClasses,
          // Só transform e opacity: a elevação e o brilho não empurram nada em volta (CLS 0).
          'motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-(--ease-out-soft) md:motion-safe:group-focus-within:-translate-y-1.5 md:motion-safe:group-hover:-translate-y-1.5',
          'md:after:pointer-events-none md:after:absolute md:after:inset-0 md:after:opacity-0 md:after:shadow-[0_22px_45px_-18px_rgb(210_138_76/0.45)] md:after:transition-opacity md:after:duration-300 md:group-focus-within:after:opacity-100 md:group-hover:after:opacity-100',
        )}
      >
        <div className={imageBoxClasses}>
          {/* Contêiner próprio para o zoom não vazar das bordas (e não cortar o selo). */}
          <div className="relative size-full overflow-hidden rounded-2xl motion-safe:before:pointer-events-none motion-safe:before:absolute motion-safe:before:inset-0 motion-safe:before:z-10 motion-safe:before:-translate-x-full motion-safe:before:bg-[linear-gradient(110deg,transparent_35%,rgb(255_255_255/0.16)_50%,transparent_65%)] motion-safe:before:transition-transform motion-safe:before:duration-700 motion-safe:before:ease-(--ease-out-soft) motion-safe:group-hover:before:translate-x-full md:rounded-[15px]">
            <img
              src={image.src}
              srcSet={image.srcSet}
              sizes="(min-width: 768px) 250px, 168px"
              alt={`Arte do NFT ${nft.name}, da coleção ${nft.collection.name}`}
              width={250}
              height={250}
              loading="lazy"
              decoding="async"
              className="size-full object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-(--ease-out-soft) motion-safe:group-focus-within:scale-[1.05] motion-safe:group-hover:scale-[1.05]"
            />
          </div>
          {nft.rarity === 'rare' && (
            <span className="absolute top-0 -left-1 flex h-8 w-[68px] items-center bg-primary pl-2 text-caption font-medium text-ink md:hidden">
              RARO
            </span>
          )}
        </div>
        <FavoriteButton
          nftId={nft.id}
          nftName={nft.name}
          className="absolute top-3 right-3 md:top-8 md:right-3"
        />
      </div>

      <div className="flex flex-col gap-1.5 pl-2 md:pl-0">
        <h3 className="text-body leading-5 text-foreground md:text-body-md md:leading-4">
          {/* O link cobre o card inteiro; o botão de favoritar fica por cima dele. */}
          <Link
            to="/nft/$nftId"
            params={{ nftId: nft.id }}
            className="after:absolute after:inset-0"
          >
            {nft.name}
          </Link>
        </h3>
        <p className="flex items-center gap-3 text-body-md font-bold text-text-accent md:text-body-lg">
          <span>{nft.priceEth} ETH</span>
          {nft.originalPriceEth && (
            <s className="font-normal text-secondary">
              <span className="sr-only">Preço original: </span>
              {nft.originalPriceEth} ETH
            </s>
          )}
        </p>
        <p className="text-caption-sm text-text-secondary">{networkLabels[nft.network]}</p>
      </div>
    </article>
  )
}

export function NftCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 md:gap-3" aria-hidden="true">
      <Skeleton className="h-[200px] rounded-[20px] md:aspect-[258/300] md:h-auto md:rounded-none" />
      <div className="flex flex-col gap-1.5 pl-2 md:pl-0">
        <Skeleton className="h-5 w-3/4 md:h-4" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3.5 w-1/4" />
      </div>
    </div>
  )
}
