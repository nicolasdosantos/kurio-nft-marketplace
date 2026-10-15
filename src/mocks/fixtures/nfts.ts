import type { Network } from '@/api/contracts/common'
import type { Collection, Edition, Nft, Rarity } from '@/api/contracts/nfts'
import { rarityLabels } from '@/lib/display'

export const collections: Collection[] = [
  { slug: 'arte-digital', name: 'Arte digital' },
  { slug: 'fotografia', name: 'Fotografia' },
  { slug: 'musica', name: 'Música' },
  { slug: 'arte-3d', name: 'Arte 3D' },
  { slug: 'colecionaveis', name: 'Colecionáveis' },
  { slug: 'generativa', name: 'Generativa' },
  { slug: 'jogos', name: 'Jogos' },
  { slug: 'assinaturas', name: 'Assinaturas' },
  { slug: 'utilidade', name: 'Utilidade' },
]

// O Figma tem só 4 artes; elas se repetem entre os NFTs, como no próprio layout.
type Artwork = 'emerald' | 'nomad' | 'baron' | 'golden'

const artworkAttributes: Record<Artwork, string[]> = {
  emerald: ['Óculos', 'Esmeralda'],
  nomad: ['Chapéu', 'Moletom'],
  baron: ['Blazer', 'Gola alta'],
  golden: ['Fones', 'Jaqueta'],
}

const artworkDescriptions: Record<Artwork, string> = {
  emerald: 'macaco de óculos redondos e jaqueta verde',
  nomad: 'gorila de chapéu verde e moletom roxo',
  baron: 'macaco de cabelo penteado, gola alta verde e blazer claro',
  golden: 'macaco dourado com fones de ouvido verdes e jaqueta clara',
}

// A raridade é de cada NFT, não da arte. O Neon Vessel #552 é o card com o selo RARO no Figma mobile.
const rareNfts = new Set([
  'Neon Vessel #552',
  'Emerald Relic #612',
  'Signature Ape #010',
  'Key Baron #104',
  'Nomad Prism #262',
  'Baron Guild #295',
])
const uncommonNfts = new Set([
  'Ivory Baron #088',
  'Golden Track #402',
  'Baron Render #077',
  'Emerald Mesh #145',
  'Quest Baron #923',
  'Pass Golden #101',
])

function rarityOf(name: string): Rarity {
  if (rareNfts.has(name)) return 'rare'
  if (uncommonNfts.has(name)) return 'uncommon'
  return 'common'
}

const contractByNetwork: Record<Network, string> = {
  ethereum: '0x7A42b1c9E8d3F05a6C2e4B7d9A1f3E5c8D0b19E8',
  polygon: '0x3F19aC0d7B2e8E4f6A5c1D9b0E7a2C4d6F8b05A1',
  solana: 'KuR1oEd1t1onsSo1anaMarketp1aceXyz11111111',
}

const networkLabel: Record<Network, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  solana: 'Solana',
}

// [nome, coleção, rede, preço, preço original, arte, listado há N dias, pontuação de tendência]
type NftRow = [string, string, Network, string, string | null, Artwork, number, number]

const rows: NftRow[] = [
  ['Emerald Ape #042', 'arte-digital', 'ethereum', '1.19', null, 'emerald', 2, 98],
  ['Sage Nomad #009', 'arte-digital', 'polygon', '1.69', null, 'nomad', 3, 87],
  ['Neon Vessel #552', 'arte-3d', 'ethereum', '1.99', '2.29', 'baron', 1, 92],
  ['Cosmic Bloom #118', 'generativa', 'solana', '1.29', null, 'nomad', 5, 75],
  ['Violet Nomad #314', 'colecionaveis', 'ethereum', '1.39', null, 'nomad', 9, 81],
  ['Ivory Baron #088', 'colecionaveis', 'polygon', '1.79', null, 'baron', 12, 66],
  ['Golden Beat #207', 'musica', 'ethereum', '0.99', null, 'golden', 4, 95],
  ['Golden Echo #071', 'musica', 'solana', '0.59', '0.79', 'golden', 6, 58],
  ['Golden Signal #160', 'musica', 'polygon', '0.39', null, 'golden', 15, 44],
  ['Emerald Lens #013', 'fotografia', 'ethereum', '2.49', null, 'emerald', 20, 70],
  ['Ivory Portrait #221', 'fotografia', 'solana', '0.85', null, 'baron', 25, 39],
  ['Sage Frame #330', 'fotografia', 'polygon', '0.12', null, 'nomad', 31, 22],
  ['Golden Track #402', 'musica', 'ethereum', '3.40', '3.90', 'golden', 8, 88],
  ['Velvet Chorus #019', 'musica', 'polygon', '0.27', null, 'nomad', 40, 18],
  ['Baron Render #077', 'arte-3d', 'solana', '4.75', null, 'baron', 11, 83],
  ['Emerald Mesh #145', 'arte-3d', 'ethereum', '6.20', '7.10', 'emerald', 3, 90],
  ['Nomad Sculpt #268', 'arte-3d', 'polygon', '0.64', null, 'nomad', 45, 15],
  ['Golden Token #500', 'colecionaveis', 'solana', '0.08', null, 'golden', 60, 9],
  ['Emerald Relic #612', 'colecionaveis', 'ethereum', '12.30', null, 'emerald', 2, 99],
  ['Baron Seal #733', 'colecionaveis', 'polygon', '2.05', null, 'baron', 17, 61],
  ['Sage Pattern #801', 'generativa', 'ethereum', '0.45', null, 'nomad', 22, 33],
  ['Golden Noise #812', 'generativa', 'polygon', '0.02', null, 'golden', 70, 5],
  ['Emerald Fractal #823', 'generativa', 'solana', '1.55', '1.80', 'emerald', 7, 72],
  ['Baron Loop #834', 'generativa', 'ethereum', '0.33', null, 'baron', 55, 12],
  ['Pixel Ape #901', 'jogos', 'polygon', '0.18', null, 'emerald', 6, 64],
  ['Arcade Nomad #912', 'jogos', 'solana', '0.72', null, 'nomad', 14, 49],
  ['Quest Baron #923', 'jogos', 'ethereum', '2.90', null, 'baron', 4, 85],
  ['Boss Golden #934', 'jogos', 'polygon', '0.54', '0.69', 'golden', 28, 41],
  ['Signature Ape #010', 'assinaturas', 'ethereum', '8.40', null, 'emerald', 10, 80],
  ['Signed Nomad #020', 'assinaturas', 'solana', '3.15', null, 'nomad', 35, 37],
  ['Inked Baron #030', 'assinaturas', 'polygon', '1.05', null, 'baron', 48, 26],
  ['Pass Golden #101', 'utilidade', 'ethereum', '0.95', null, 'golden', 5, 77],
  ['Access Ape #102', 'utilidade', 'polygon', '0.25', null, 'emerald', 19, 52],
  ['Member Nomad #103', 'utilidade', 'solana', '0.15', null, 'nomad', 26, 30],
  ['Key Baron #104', 'utilidade', 'ethereum', '5.60', '6.00', 'baron', 1, 94],
  ['Amber Ape #205', 'arte-digital', 'solana', '0.68', null, 'emerald', 33, 28],
  ['Dusk Nomad #216', 'arte-digital', 'ethereum', '2.15', null, 'nomad', 16, 68],
  ['Copper Baron #227', 'arte-digital', 'polygon', '0.47', null, 'baron', 42, 20],
  ['Golden Hour #238', 'fotografia', 'ethereum', '1.10', null, 'golden', 13, 57],
  ['Emerald Exposure #249', 'fotografia', 'polygon', '0.36', null, 'emerald', 50, 14],
  ['Baron Bassline #251', 'musica', 'solana', '0.88', null, 'baron', 9, 60],
  ['Nomad Prism #262', 'arte-3d', 'ethereum', '9.75', null, 'nomad', 6, 89],
  ['Golden Relic #273', 'colecionaveis', 'solana', '0.22', null, 'golden', 38, 24],
  ['Emerald Seed #284', 'generativa', 'polygon', '1.42', null, 'emerald', 21, 46],
  ['Baron Guild #295', 'jogos', 'solana', '4.10', '4.60', 'baron', 2, 91],
]

const LISTING_BASE_DATE = Date.UTC(2026, 9, 1, 12)
const DAY_MS = 24 * 60 * 60 * 1000
const FIGMA_CARD_COUNT = 9

function slugify(name: string) {
  return name.toLowerCase().replace('#', '').replace(/\s+/g, '-')
}

// Estoque varia pelo índice para ter edições esgotadas espalhadas pelo catálogo.
function buildEditions(index: number): Edition[] {
  return [
    { id: '1-1', label: '1/1', stock: index % 5 === 0 ? 0 : 1, maxPerOrder: 1 },
    { id: '1-10', label: '1/10', stock: index % 7 === 0 ? 0 : 10 - (index % 4), maxPerOrder: 10 },
    { id: '1-50', label: '1/50', stock: 50 - (index % 13), maxPerOrder: 10 },
    { id: 'open', label: 'Aberta', stock: 999, maxPerOrder: 20 },
  ]
}

function buildNft(row: NftRow, index: number): Nft {
  const [
    name,
    collectionSlug,
    network,
    priceEth,
    originalPriceEth,
    artwork,
    daysAgo,
    trendingScore,
  ] = row
  const collection = collections.find((item) => item.slug === collectionSlug)!
  const tokenNumber = name.split('#')[1] ?? String(index)
  const rarity = rarityOf(name)
  // Os 9 primeiros são os cards do Figma: ficam como os mais recentes, na mesma ordem do layout.
  const listedDaysAgo = index < FIGMA_CARD_COUNT ? index + 1 : daysAgo + FIGMA_CARD_COUNT

  return {
    id: slugify(name),
    tokenId: `#${tokenNumber.padStart(4, '0')}`,
    name,
    collection,
    network,
    imageUrl: `/nfts/${artwork}-800.webp`,
    priceEth,
    originalPriceEth,
    isNew: listedDaysAgo <= 7,
    trendingScore,
    rarity,
    listedAt: new Date(LISTING_BASE_DATE - listedDaysAgo * DAY_MS).toISOString(),
    version: 1,
    description: `${name} é uma obra digital da coleção ${collection.name}, verificada na ${networkLabel[network]}. Cada atributo fica registrado nos metadados do token, com procedência permanente na rede e arte desbloqueável para colecionadores.`,
    imageDescription: artworkDescriptions[artwork],
    attributes: [...artworkAttributes[artwork], rarityLabels[rarity]],
    contractAddress: contractByNetwork[network],
    royaltyPercent: 5,
    rating: { average: 4.8, count: index === 0 ? 19 : 3 + (index % 9) },
    reviews: [
      {
        author: 'colecionador.eth',
        rating: 5,
        comment: 'Arte impecável e transferência rápida.',
        createdAt: '2026-09-20T14:00:00.000Z',
      },
      {
        author: 'nova.sato',
        rating: 4,
        comment: 'Gostei bastante dos detalhes, recomendo a edição 1/10.',
        createdAt: '2026-09-12T09:30:00.000Z',
      },
    ],
    editions: buildEditions(index),
  }
}

export const nftFixtures: Nft[] = rows.map(buildNft)
