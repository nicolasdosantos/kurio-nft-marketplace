export function HomeHero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="hidden min-h-[450px] items-center justify-between gap-8 pl-10 md:flex"
    >
      <div className="flex w-full max-w-[600px] flex-col items-end gap-11">
        <div className="flex w-full flex-col items-start gap-8">
          <div className="flex flex-col gap-1">
            <div className="flex flex-col gap-2 text-foreground">
              <p className="text-body-sm font-medium tracking-[1.4px]">Bem-vindo à Kurio</p>
              <h1
                id="hero-title"
                className="text-[32px] leading-[52px] font-bold lg:text-display lg:leading-[70px]"
              >
                SEJA DONO DO FUTURO
                <br />
                DA ARTE DIGITAL
              </h1>
            </div>
            <p className="max-w-[557px] text-body-sm leading-6 text-text-secondary">
              Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte
              digital rara, apoie artistas e tenha uma parte da cultura da internet.
            </p>
          </div>
          <a
            href="#catalogo"
            className="flex h-10 w-[140px] items-center justify-center rounded-[6px] bg-primary text-body-md leading-5 font-bold text-ink hover:bg-text-accent"
          >
            EXPLORAR
          </a>
        </div>
        <img src="/icons/hero-dots.svg" alt="" width={40} height={8} />
      </div>
      <img
        src="/nfts/emerald-800.webp"
        alt="Arte do NFT Emerald Ape #042: macaco de óculos redondos e jaqueta verde"
        width={450}
        height={450}
        fetchPriority="high"
        className="aspect-square w-[45%] max-w-[450px] shrink-0 rounded-3xl object-cover"
      />
    </section>
  )
}

export function MobileHeroBanner() {
  return (
    <section
      aria-labelledby="mobile-hero-title"
      className="relative flex h-[190px] flex-col items-center justify-center gap-4 overflow-hidden rounded-xl p-4 md:hidden"
    >
      <img src="/icons/mobile-hero-mask.svg" alt="" className="absolute inset-0 size-full" />
      <div className="relative flex w-full items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-col gap-1.5">
            <p className="text-caption-sm leading-4 font-medium text-foreground">
              Bem-vindo à Kurio
            </p>
            <h1
              id="mobile-hero-title"
              className="max-w-[190px] text-body-lg leading-[29px] font-bold text-foreground"
            >
              SEJA DONO DA CULTURA DIGITAL
            </h1>
            <p className="text-caption-sm leading-[18px] text-text-secondary">
              Descubra NFTs selecionados de criadores do mundo todo.
            </p>
          </div>
          <a
            href="#catalogo"
            className="flex items-center gap-2 text-caption-sm font-bold text-text-accent"
          >
            EXPLORAR
            <img
              src="/icons/mobile-arrow-right.svg"
              alt=""
              width={10}
              height={12}
              className="-rotate-90"
            />
          </a>
        </div>
        <div className="relative aspect-square w-[36%] max-w-[138px] shrink-0">
          <img
            src="/nfts/emerald-400.webp"
            alt="Arte do NFT Emerald Ape #042"
            width={138}
            height={138}
            fetchPriority="high"
            className="size-full rounded-2xl object-cover"
          />
          <img
            src="/nfts/nomad-400.webp"
            alt=""
            width={58}
            height={58}
            className="absolute top-[64%] left-[10%] w-[42%] rounded-2xl object-cover"
          />
        </div>
      </div>
      <img src="/icons/mobile-hero-dots.svg" alt="" width={33} height={7} className="relative" />
    </section>
  )
}
