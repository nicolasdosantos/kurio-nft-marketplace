import Decimal from 'decimal.js'
import { http, HttpResponse } from 'msw'
import type { Network } from '@/api/contracts/common'
import { nftListParamsSchema, type Nft, type NftSummary } from '@/api/contracts/nfts'
import { collections } from '../fixtures/nfts'
import { findNft, getDb } from '../db'
import { notFound, validationError } from '../responses'

const networks: Network[] = ['ethereum', 'polygon', 'solana']

function toSummary(nft: Nft): NftSummary {
  return {
    id: nft.id,
    tokenId: nft.tokenId,
    name: nft.name,
    collection: nft.collection,
    network: nft.network,
    imageUrl: nft.imageUrl,
    priceEth: nft.priceEth,
    originalPriceEth: nft.originalPriceEth,
    isNew: nft.isNew,
    trendingScore: nft.trendingScore,
    rarity: nft.rarity,
    listedAt: nft.listedAt,
    version: nft.version,
  }
}

function buildFacets(nfts: Nft[]) {
  const prices = nfts.map((nft) => new Decimal(nft.priceEth))
  return {
    collections: collections.map((collection) => ({
      ...collection,
      count: nfts.filter((nft) => nft.collection.slug === collection.slug).length,
    })),
    networks: networks.map((network) => ({
      id: network,
      count: nfts.filter((nft) => nft.network === network).length,
    })),
    priceRange: {
      min: Decimal.min(...prices).toFixed(),
      max: Decimal.max(...prices).toFixed(),
    },
  }
}

export const nftHandlers = [
  http.get('/api/nfts', ({ request }) => {
    const searchParams = new URL(request.url).searchParams
    const parsed = nftListParamsSchema.safeParse({
      q: searchParams.get('q') ?? undefined,
      collection: searchParams.getAll('collection'),
      network: searchParams.getAll('network'),
      minPrice: searchParams.get('minPrice') ?? undefined,
      maxPrice: searchParams.get('maxPrice') ?? undefined,
      tab: searchParams.get('tab') ?? undefined,
      sort: searchParams.get('sort') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
    })
    if (!parsed.success) return validationError(parsed.error)
    const params = parsed.data

    const allNfts = getDb().nfts
    const search = params.q?.toLowerCase()

    let matches = allNfts.filter((nft) => {
      if (search && !`${nft.name} ${nft.collection.name}`.toLowerCase().includes(search)) {
        return false
      }
      if (params.collection.length > 0 && !params.collection.includes(nft.collection.slug)) {
        return false
      }
      if (params.network.length > 0 && !params.network.includes(nft.network)) return false

      const price = new Decimal(nft.priceEth)
      if (params.minPrice && price.lessThan(params.minPrice)) return false
      if (params.maxPrice && price.greaterThan(params.maxPrice)) return false

      if (params.tab === 'new' && !nft.isNew) return false
      if (params.tab === 'trending' && nft.trendingScore < 70) return false
      return true
    })

    matches = [...matches].sort((a, b) => {
      switch (params.sort) {
        case 'price-asc':
          return new Decimal(a.priceEth).comparedTo(b.priceEth)
        case 'price-desc':
          return new Decimal(b.priceEth).comparedTo(a.priceEth)
        case 'name':
          return a.name.localeCompare(b.name, 'pt-BR')
        default:
          return b.listedAt.localeCompare(a.listedAt)
      }
    })

    const total = matches.length
    const totalPages = Math.max(1, Math.ceil(total / params.pageSize))
    const start = (params.page - 1) * params.pageSize

    return HttpResponse.json({
      items: matches.slice(start, start + params.pageSize).map(toSummary),
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages,
      facets: buildFacets(allNfts),
    })
  }),

  http.get('/api/nfts/:nftId', ({ params }) => {
    const nft = findNft(String(params.nftId))
    if (!nft) return notFound('NFT não encontrado.')
    return HttpResponse.json(nft)
  }),
]
