import { Link } from '@tanstack/react-router'

export function FeaturedBanner() {
  return (
    <Link
      to="/"
      search={{ tab: 'trending' }}
      aria-label="NFT em destaque, oferta limitada: ver os NFTs em alta"
      className="relative flex h-[470px] w-[310px] flex-col gap-4 overflow-hidden bg-linear-to-b from-primary/10 to-primary/[0.03] pt-6 pb-1"
    >
      <p className="px-5 text-heading leading-8 font-bold text-text-accent">NFT EM DESTAQUE</p>
      <p className="px-5 text-center text-[22px] leading-4 font-bold text-foreground">
        OFERTA LIMITADA
      </p>
      <img
        src="/nfts/nomad-800.webp"
        alt=""
        width={310}
        height={368}
        loading="lazy"
        className="h-[368px] w-full rounded-[22px] object-cover"
      />
      <span
        aria-hidden="true"
        className="absolute top-[299px] left-4 size-[22px] rounded-[7px] border-2 border-[#46a358] opacity-20"
      />
      <span
        aria-hidden="true"
        className="absolute top-[343px] left-[248px] size-[45px] rounded-[29px] bg-[linear-gradient(145deg,rgba(210,138,76,0.3)_46%,rgba(210,138,76,0)_103%)]"
      />
      <span
        aria-hidden="true"
        className="absolute top-[105px] left-[38px] size-[15px] rounded-[29px] bg-[linear-gradient(145deg,rgba(210,138,76,0.3)_46%,rgba(210,138,76,0)_103%)]"
      />
    </Link>
  )
}
