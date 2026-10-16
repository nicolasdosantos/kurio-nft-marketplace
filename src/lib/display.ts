import type { WalletSlot, WalletType } from '@/api/contracts/account'
import type { Network } from '@/api/contracts/common'
import type { Rarity } from '@/api/contracts/nfts'

export const networkLabels: Record<Network, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  solana: 'Solana',
}

export const walletTypeLabels: Record<WalletType, string> = {
  metamask: 'MetaMask',
  walletconnect: 'WalletConnect',
  coinbase: 'Coinbase Wallet',
}

export const walletSlotLabels: Record<WalletSlot, string> = {
  primary: 'Principal',
  secondary: 'Reserva',
}

export const rarityLabels: Record<Rarity, string> = {
  common: 'Comum',
  uncommon: 'Incomum',
  rare: 'Raro',
}

// As imagens existem em 400px (cards) e 800px (detalhe/hero).
export function nftImageSources(imageUrl: string) {
  const small = imageUrl.replace('-800.webp', '-400.webp')
  return {
    src: small,
    srcSet: `${small} 400w, ${imageUrl} 800w`,
  }
}

// No filtro de preço o Figma usa vírgula decimal ("0,02 - 12,30 ETH").
export function formatEthWithComma(value: string) {
  return value.replace('.', ',')
}
