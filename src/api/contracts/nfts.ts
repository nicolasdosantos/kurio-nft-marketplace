import { z } from 'zod'
import { ethAmountSchema, networkSchema } from './common'

export const editionIdSchema = z.enum(['1-1', '1-10', '1-50', 'open'])
export type EditionId = z.infer<typeof editionIdSchema>

export const editionSchema = z.object({
  id: editionIdSchema,
  label: z.string(),
  stock: z.number().int().min(0),
  maxPerOrder: z.number().int().min(1),
})
export type Edition = z.infer<typeof editionSchema>

export const collectionSchema = z.object({
  slug: z.string(),
  name: z.string(),
})
export type Collection = z.infer<typeof collectionSchema>

export const raritySchema = z.enum(['common', 'uncommon', 'rare'])
export type Rarity = z.infer<typeof raritySchema>

export const nftSummarySchema = z.object({
  id: z.string(),
  tokenId: z.string(),
  name: z.string(),
  collection: collectionSchema,
  network: networkSchema,
  imageUrl: z.string(),
  priceEth: ethAmountSchema,
  originalPriceEth: ethAmountSchema.nullable(),
  isNew: z.boolean(),
  trendingScore: z.number(),
  rarity: raritySchema,
  listedAt: z.string(),
  version: z.number().int(),
})
export type NftSummary = z.infer<typeof nftSummarySchema>

export const reviewSchema = z.object({
  author: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string(),
  createdAt: z.string(),
})

export const nftSchema = nftSummarySchema.extend({
  description: z.string(),
  attributes: z.array(z.string()),
  contractAddress: z.string(),
  royaltyPercent: z.number(),
  rating: z.object({ average: z.number(), count: z.number().int() }),
  reviews: z.array(reviewSchema),
  editions: z.array(editionSchema),
})
export type Nft = z.infer<typeof nftSchema>

export const nftTabSchema = z.enum(['all', 'new', 'trending'])
export const nftSortSchema = z.enum(['recent', 'price-asc', 'price-desc', 'name'])
export type NftTab = z.infer<typeof nftTabSchema>
export type NftSort = z.infer<typeof nftSortSchema>

export const nftListParamsSchema = z.object({
  q: z.string().trim().optional(),
  collection: z.array(z.string()).default([]),
  network: z.array(networkSchema).default([]),
  minPrice: ethAmountSchema.optional(),
  maxPrice: ethAmountSchema.optional(),
  tab: nftTabSchema.default('all'),
  sort: nftSortSchema.default('recent'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(9),
})
export type NftListParams = z.input<typeof nftListParamsSchema>

export const nftListResponseSchema = z.object({
  items: z.array(nftSummarySchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
  facets: z.object({
    collections: z.array(collectionSchema.extend({ count: z.number().int() })),
    networks: z.array(z.object({ id: networkSchema, count: z.number().int() })),
    priceRange: z.object({ min: ethAmountSchema, max: ethAmountSchema }),
  }),
})
export type NftListResponse = z.infer<typeof nftListResponseSchema>

export const favoritesResponseSchema = z.object({
  nftIds: z.array(z.string()),
})
export type FavoritesResponse = z.infer<typeof favoritesResponseSchema>
