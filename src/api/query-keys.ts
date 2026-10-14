import type { Network } from './contracts/common'
import type { NftListParams } from './contracts/nfts'

// Dados públicos ficam em "nfts". Tudo que é privado fica embaixo do dono
// ("user:<id>" ou "guest:<carrinho>"), assim trocar de usuário nunca mistura cache.
export const queryKeys = {
  nfts: ['nfts'] as const,
  nftList: (params: NftListParams) => ['nfts', 'list', params] as const,
  nftDetail: (nftId: string) => ['nfts', 'detail', nftId] as const,

  owner: (owner: string) => ['owner', owner] as const,
  cart: (owner: string) => ['owner', owner, 'cart'] as const,
  quote: (owner: string, network: Network) => ['owner', owner, 'quote', network] as const,
  favorites: (owner: string) => ['owner', owner, 'favorites'] as const,
  orders: (owner: string) => ['owner', owner, 'orders'] as const,
  order: (owner: string, orderId: string) => ['owner', owner, 'orders', orderId] as const,
  profile: (owner: string) => ['owner', owner, 'profile'] as const,
  wallets: (owner: string) => ['owner', owner, 'wallets'] as const,
}
