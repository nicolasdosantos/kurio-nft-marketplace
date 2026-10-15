import { ComingSoon } from './ComingSoon'

const highlights = [
  {
    letter: 'W',
    title: 'Segurança da carteira',
    text: 'Proteja sua carteira e colecione arte digital verificada com confiança.',
  },
  {
    letter: 'C',
    title: 'Criadores em destaque',
    text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.',
  },
  {
    letter: 'D',
    title: 'Alertas de lançamentos',
    text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.',
  },
]

const linkColumns = [
  {
    title: 'Meu perfil',
    links: ['Meu perfil', 'Minha coleção', 'Atividade', 'Estúdio do criador', 'Lista de interesse'],
  },
  {
    title: 'Central de ajuda',
    links: [
      'Central de ajuda',
      'Como comprar NFTs',
      'Carteira e segurança',
      'Política do mercado',
      'Denunciar item',
    ],
  },
  {
    title: 'Coleções',
    links: ['Arte digital', 'Fotografia', 'Música', 'Arte 3D', 'Utilidade'],
  },
]

const socialNetworks = [
  { name: 'Facebook', icon: '/icons/social-facebook.svg' },
  { name: 'Instagram', icon: '/icons/social-instagram.svg' },
  { name: 'Twitter', icon: '/icons/social-twitter.svg' },
  { name: 'LinkedIn', icon: '/icons/social-linkedin.svg' },
  { name: 'YouTube', icon: '/icons/social-youtube.svg' },
]

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-24 w-full max-w-[1232px] px-4 pb-36 md:pb-6">
      <section className="grid gap-8 bg-surface-card p-6 md:grid-cols-2 md:p-8 xl:flex xl:h-[250px] xl:items-end xl:gap-0">
        {highlights.map((highlight) => (
          <div
            key={highlight.title}
            className="flex min-w-0 flex-col gap-3 px-4 xl:w-[265px] xl:border-r xl:border-primary xl:first:flex-1"
          >
            <span
              aria-hidden="true"
              className="grid size-[74px] place-items-center rounded-full bg-primary text-heading font-bold text-ink"
            >
              {highlight.letter}
            </span>
            <h2 className="text-[17px] leading-4 font-bold text-foreground">{highlight.title}</h2>
            <p className="max-w-[204px] text-body-sm leading-[22px] text-text-secondary">
              {highlight.text}
            </p>
          </div>
        ))}
        <div className="flex min-w-0 flex-col gap-3 px-4 xl:h-full xl:w-[357px]">
          <h2 className="text-body-lg font-bold text-foreground">
            Antecipe-se ao próximo lançamento
          </h2>
          <form
            onSubmit={(event) => event.preventDefault()}
            className="mt-1 flex h-10 items-center rounded-[6px] bg-surface-dark pl-3 drop-shadow-[0_0_10px_rgba(10,6,4,0.45)]"
          >
            <label htmlFor="newsletter-email" className="sr-only">
              E-mail para novidades (em breve)
            </label>
            <input
              id="newsletter-email"
              type="email"
              disabled
              placeholder="digite seu e-mail..."
              className="min-w-0 flex-1 bg-transparent text-body-sm text-secondary placeholder:text-secondary disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled
              title="Em breve"
              className="h-10 w-[85px] rounded-r-[6px] bg-primary pr-1 pl-4 text-body-lg font-bold text-ink disabled:cursor-not-allowed disabled:opacity-60"
            >
              Enviar
            </button>
          </form>
          <p className="text-caption leading-[22px] text-text-secondary">
            Receba lançamentos selecionados, histórias de criadores e novidades do mercado.
            <span className="block text-caption-sm text-secondary">Newsletter em breve.</span>
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-4 bg-surface-dark p-8 text-body-sm leading-[22px] text-foreground md:grid md:grid-cols-2 xl:flex xl:h-[88px] xl:items-center xl:gap-[92px]">
        <span className="flex-1 font-bold tracking-[1.4px]">KURIO</span>
        <p className="flex-1 xl:whitespace-nowrap">
          Feito para colecionadores,
          <br />
          criadores e cultura
        </p>
        <a href="mailto:contato@email.com" className="flex-1 underline-offset-4 hover:underline">
          contato@email.com
        </a>
        <a href="tel:+551140028922" className="underline-offset-4 hover:underline xl:w-[228px]">
          +55 11 4002 8922
        </a>
      </section>

      <section className="grid gap-8 bg-surface-card p-8 md:grid-cols-2 xl:flex xl:gap-[124px]">
        {linkColumns.map((column) => (
          <nav key={column.title} aria-label={column.title} className="flex flex-1 flex-col gap-2">
            <h2 className="text-body-lg font-bold text-foreground">{column.title}</h2>
            <ul className="text-body-sm leading-[30px] text-foreground">
              {column.links.map((label) => (
                <li key={label}>
                  <ComingSoon>{label}</ComingSoon>
                </li>
              ))}
            </ul>
          </nav>
        ))}
        <div className="flex flex-col gap-8 xl:w-[228px]">
          <div className="flex flex-col gap-5">
            <h2 className="text-body-lg font-bold text-foreground">Redes sociais</h2>
            <ul className="flex gap-2.5">
              {socialNetworks.map((network) => (
                <li key={network.name}>
                  <ComingSoon className="block">
                    <img src={network.icon} alt={network.name} width={30} height={30} />
                  </ComingSoon>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="text-body-lg font-bold text-foreground">Carteiras compatíveis</h2>
            <p className="flex h-[26px] items-center justify-center rounded-[6px] border border-border-soft bg-surface-dark text-tiny-sm font-bold tracking-[0.1px] whitespace-pre text-text-accent">
              {'METAMASK  •  WALLETCONNECT  •  COINBASE'}
            </p>
          </div>
        </div>
      </section>

      <p className="pt-1.5 text-center text-body-sm leading-[30px] text-foreground">
        © 2026 Kurio. Propriedade digital para todos.
      </p>
    </footer>
  )
}
