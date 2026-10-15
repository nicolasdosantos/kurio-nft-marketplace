import { useNftList } from '@/api/catalog'
import type { Nft } from '@/api/contracts/nfts'
import { NftCarousel } from './NftCarousel'

export function RelatedNfts({ nft }: { nft: Nft }) {
  const listQuery = useNftList({ collection: [nft.collection.slug], pageSize: 12 })
  const related = listQuery.data?.items.filter((item) => item.id !== nft.id) ?? []

  return <NftCarousel title="Mais desta coleção" items={related} isPending={listQuery.isPending} />
}
