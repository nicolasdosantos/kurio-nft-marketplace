import { Link } from '@tanstack/react-router'
import type { CatalogSearch } from '@/lib/catalog-search'

const promos: { title: string[]; text: string; image: string; search: CatalogSearch }[] = [
  {
    title: ['Lançamentos gênesis', 'de edição limitada'],
    text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
    image: '/nfts/emerald-800.webp',
    search: { tab: 'new' },
  },
  {
    title: ['Arte digital selecionada', 'e muito mais'],
    text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.',
    image: '/nfts/baron-800.webp',
    search: { collections: ['arte-digital'] },
  },
]

export function PromoCards() {
  return (
    <section aria-label="Promoções" className="hidden gap-7 md:grid md:grid-cols-2">
      {promos.map((promo) => (
        <article
          key={promo.title[0]}
          className="relative flex h-[250px] overflow-hidden rounded-lg bg-surface-card"
        >
          <img
            src={promo.image}
            alt=""
            width={292}
            height={250}
            loading="lazy"
            className="h-[250px] w-1/2 max-w-[292px] rounded-[18px] object-cover"
          />
          <div className="relative flex flex-1 flex-col items-end gap-4 pt-9 pr-4 text-right lg:pr-[30px]">
            <h2 className="text-body-lg leading-6 font-bold text-foreground xl:whitespace-nowrap">
              {promo.title[0]}
              <br />
              {promo.title[1]}
            </h2>
            <p className="max-w-[263px] text-body-sm leading-6 text-text-secondary">{promo.text}</p>
            <Link
              to="/"
              search={promo.search}
              className="mt-auto mb-[46px] flex h-10 w-[140px] shrink-0 items-center justify-center gap-3 rounded-[6px] bg-primary text-body-sm leading-5 font-medium text-ink hover:bg-text-accent"
            >
              Explorar
              <img
                src="/icons/arrow-right.svg"
                loading="lazy"
                alt=""
                width={11}
                height={13}
                className="-rotate-90"
              />
            </Link>
          </div>
          <img
            src="/icons/promo-mask.svg"
            loading="lazy"
            alt=""
            className="pointer-events-none absolute inset-0 size-full"
          />
        </article>
      ))}
    </section>
  )
}
