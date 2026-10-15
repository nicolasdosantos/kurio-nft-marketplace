import { ComingSoon } from '@/components/layout/ComingSoon'

const posts = [
  {
    date: '12 de setembro',
    readingTime: '6 min',
    title: 'Como funciona a propriedade de NFTs',
    summary: 'Aprenda a colecionar, negociar e verificar ativos digitais.',
    image: '/nfts/baron-400.webp',
  },
  {
    date: '13 de setembro',
    readingTime: '2 min',
    title: '10 artistas digitais para acompanhar',
    summary: 'Conheça criadores que moldam a cultura digital.',
    image: '/nfts/emerald-400.webp',
  },
  {
    date: '15 de setembro',
    readingTime: '3 min',
    title: 'Raridade, atributos e procedência',
    summary: 'Entenda raridade, procedência, direitos autorais e utilidade.',
    image: '/nfts/nomad-400.webp',
  },
  {
    date: '15 de setembro',
    readingTime: '2 min',
    title: 'Como proteger sua carteira',
    summary: 'Proteja sua carteira, seus ativos e sua identidade.',
    image: '/nfts/golden-400.webp',
  },
]

export function BlogSection() {
  return (
    <section aria-labelledby="blog-title" className="hidden flex-col items-center gap-10 md:flex">
      <header className="flex flex-col gap-3 text-center">
        <h2 id="blog-title" className="text-[28px] font-bold text-text-primary">
          Diário da Cunhagem
        </h2>
        <p className="text-body-sm text-text-secondary">
          Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.
        </p>
      </header>
      <ul className="grid w-full grid-cols-2 gap-6 lg:grid-cols-4 xl:grid-cols-[repeat(4,268px)]">
        {posts.map((post) => (
          <li key={post.title} className="flex flex-col overflow-hidden rounded-lg bg-surface-card">
            <img
              src={post.image}
              alt=""
              width={268}
              height={195}
              loading="lazy"
              className="h-[195px] w-full object-cover"
            />
            <div className="flex flex-1 flex-col gap-2 px-4 pt-3 pb-4">
              <p className="text-caption-sm leading-4 font-medium whitespace-pre-wrap text-text-secondary">
                {`${post.date}  |  Leitura de ${post.readingTime}`}
              </p>
              <h3 className="text-body-md font-bold text-text-primary">{post.title}</h3>
              <p className="text-caption-sm leading-4 font-medium text-text-secondary">
                {post.summary}
              </p>
              <ComingSoon className="mt-auto text-caption-sm text-text-accent">
                <span className="font-bold">Ler mais</span> →
              </ComingSoon>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
