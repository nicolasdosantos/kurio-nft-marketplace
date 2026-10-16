import { useState, type ReactNode } from 'react'
import type { Nft } from '@/api/contracts/nfts'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { nftImageSources } from '@/lib/display'
import { cn } from '@/lib/utils'

// Cada NFT tem uma arte só; a galeria mostra recortes dela, como as miniaturas do Figma.
const galleryViews = [
  { label: 'vista completa', crop: '' },
  { label: 'detalhe do rosto', crop: 'scale-[1.8] origin-[50%_30%]' },
  { label: 'detalhe da roupa', crop: 'scale-[1.7] origin-[50%_92%]' },
  { label: 'vista aproximada', crop: 'scale-[1.3]' },
]

function galleryAlt(nft: Nft, viewIndex: number) {
  const alt = `Arte do NFT ${nft.name}: ${nft.imageDescription}`
  return viewIndex === 0 ? alt : `${alt}, ${galleryViews[viewIndex]?.label}`
}

interface GalleryProps {
  nft: Nft
  viewIndex: number
  onViewChange: (viewIndex: number) => void
}

export function NftGallery({ nft, viewIndex, onViewChange }: GalleryProps) {
  const [zoomOpen, setZoomOpen] = useState(false)
  const view = galleryViews[viewIndex] ?? galleryViews[0]!
  const thumbnail = nftImageSources(nft.imageUrl).src

  return (
    // Largura fixa no desktop: sem ela, o skeleton não reserva o lugar da imagem.
    <div className="flex w-full gap-7 lg:w-[572px] lg:shrink-0">
      <div role="group" aria-label="Imagens do NFT" className="flex shrink-0 flex-col gap-4">
        {galleryViews.map((item, index) => (
          <button
            key={item.label}
            type="button"
            aria-label={`Mostrar ${item.label}`}
            aria-pressed={index === viewIndex}
            onClick={() => onViewChange(index)}
            className={cn(
              'size-[100px] overflow-hidden rounded-lg bg-surface-card',
              index === viewIndex && 'ring-1 ring-primary',
            )}
          >
            <img
              src={thumbnail}
              alt=""
              width={100}
              height={100}
              className={cn('size-full object-cover', item.crop)}
            />
          </button>
        ))}
      </div>

      <div className="relative w-full max-w-[444px] self-start rounded-md bg-surface-card p-4">
        <div className="aspect-square overflow-hidden rounded-3xl">
          <img
            {...nftImageSources(nft.imageUrl)}
            sizes="404px"
            alt={galleryAlt(nft, viewIndex)}
            width={404}
            height={404}
            fetchPriority="high"
            data-testid="gallery-main"
            className={cn('size-full object-cover', view.crop)}
          />
        </div>
        <button
          type="button"
          aria-label="Ampliar imagem"
          onClick={() => setZoomOpen(true)}
          className="absolute top-[13px] right-3 grid size-[30px] place-items-center rounded-full border border-border bg-surface-raised"
        >
          <img src="/icons/detail-zoom.svg" alt="" width={20} height={20} />
        </button>
      </div>

      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-[min(90vw,720px)] border border-border bg-surface-card p-3 sm:max-w-[min(90vw,720px)]">
          <DialogTitle className="sr-only">{nft.name}</DialogTitle>
          <DialogDescription className="sr-only">Imagem ampliada da arte.</DialogDescription>
          <div className="overflow-hidden rounded-2xl">
            <img
              src={nft.imageUrl}
              alt={galleryAlt(nft, viewIndex)}
              width={800}
              height={800}
              className={cn('size-full object-cover', view.crop)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface MobileHeroProps extends GalleryProps {
  onBack: () => void
  favoriteButton: ReactNode
}

// Topo do Figma mobile: voltar, favoritar, a arte e os pontos da galeria.
export function MobileNftHero({
  nft,
  viewIndex,
  onViewChange,
  onBack,
  favoriteButton,
}: MobileHeroProps) {
  const view = galleryViews[viewIndex] ?? galleryViews[0]!

  return (
    <section
      aria-label="Imagens do NFT"
      className="bg-[linear-gradient(140deg,var(--color-surface-card)_0%,var(--color-surface-raised)_100%)] px-7 pt-[23px] pb-[84px]"
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Voltar"
          onClick={onBack}
          className="grid size-[35px] place-items-center rounded-full border border-border bg-surface-raised"
        >
          <img src="/icons/arrow-left.svg" alt="" width={20} height={20} />
        </button>
        {favoriteButton}
      </div>

      <div className="relative mt-2">
        <div className="aspect-[361/356] overflow-hidden rounded-3xl">
          <img
            {...nftImageSources(nft.imageUrl)}
            sizes="calc(100vw - 56px)"
            alt={galleryAlt(nft, viewIndex)}
            width={361}
            height={356}
            fetchPriority="high"
            data-testid="gallery-main"
            className={cn('size-full object-cover', view.crop)}
          />
        </div>
        {/* Botões de 24px (alvo de toque mínimo); o ponto do Figma fica dentro deles. */}
        <div className="absolute bottom-[42px] left-1/2 flex -translate-x-1/2 items-center">
          {galleryViews.map((item, index) => (
            <button
              key={item.label}
              type="button"
              aria-label={`Mostrar ${item.label}`}
              aria-pressed={index === viewIndex}
              onClick={() => onViewChange(index)}
              className="grid h-6 min-w-6 place-items-center px-1"
            >
              <span
                className={cn(
                  'h-[7px] rounded-full bg-primary',
                  index === viewIndex ? 'w-7' : 'w-[7px]',
                )}
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
