import type { Nft } from '@/api/types'

export const nftFixtures: Nft[] = [
  {
    id: 'nft-1',
    name: 'Cubo Âmbar #01',
    collection: 'Formas Quentes',
    network: 'ethereum',
    priceEth: '1.99',
    originalPriceEth: '2.29',
    editionsAvailable: 10,
    version: 1,
  },
  {
    id: 'nft-2',
    name: 'Duna Cobre',
    collection: 'Paisagens Lentas',
    network: 'polygon',
    priceEth: '0.45',
    originalPriceEth: null,
    editionsAvailable: 50,
    version: 1,
  },
  {
    id: 'nft-3',
    name: 'Eco Terracota',
    collection: 'Formas Quentes',
    network: 'solana',
    priceEth: '3.10',
    originalPriceEth: null,
    editionsAvailable: 1,
    version: 1,
  },
]
