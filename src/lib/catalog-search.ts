import { z } from 'zod'
import { ethAmountSchema, networkSchema } from '@/api/contracts/common'
import { nftSortSchema, nftTabSchema, type NftListParams } from '@/api/contracts/nfts'

// Valores inválidos na URL viram "sem filtro" em vez de quebrar a página.
export const catalogSearchSchema = z.object({
  q: z.string().trim().min(1).optional().catch(undefined),
  collections: z.array(z.string()).optional().catch(undefined),
  networks: z.array(networkSchema).optional().catch(undefined),
  minPrice: ethAmountSchema.optional().catch(undefined),
  maxPrice: ethAmountSchema.optional().catch(undefined),
  tab: nftTabSchema.optional().catch(undefined),
  sort: nftSortSchema.optional().catch(undefined),
  page: z.number().int().min(2).optional().catch(undefined),
})
export type CatalogSearch = z.infer<typeof catalogSearchSchema>

export const CATALOG_PAGE_SIZE = 9

export function toNftListParams(search: CatalogSearch): NftListParams {
  return {
    q: search.q,
    collection: search.collections ?? [],
    network: search.networks ?? [],
    minPrice: search.minPrice,
    maxPrice: search.maxPrice,
    tab: search.tab ?? 'all',
    sort: search.sort ?? 'recent',
    page: search.page ?? 1,
    pageSize: CATALOG_PAGE_SIZE,
  }
}
