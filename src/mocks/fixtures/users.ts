import type { Network } from '@/api/contracts/common'
import type { WalletType } from '@/api/contracts/account'

// Credenciais fictícias, documentadas no README. No banco só fica o hash.
export const userFixtures = [
  {
    id: 'user-ana',
    displayName: 'Ana Ribeiro',
    username: 'ana.ribeiro',
    email: 'ana@kurio.dev',
    password: 'kurio123',
    ensName: 'anaribeiro.eth',
    walletNickname: 'Cofre da Ana',
    favorites: ['emerald-ape-042', 'neon-vessel-552', 'golden-track-402'],
    primaryWallet: {
      nickname: 'MetaMask principal',
      network: 'ethereum' as Network,
      walletType: 'metamask' as WalletType,
      address: '0xA91F5c3D7e2B8a4C6d0E1f9B3a5C7e2D4f6AE82C',
      ensName: 'anaribeiro.eth',
    },
    secondaryWallet: {
      nickname: 'Coinbase reserva',
      network: 'polygon' as Network,
      walletType: 'coinbase' as WalletType,
      address: '0x5B2d8F1a3C9e7D4b6A0f2E8c1D3b5A7f9C0e2B4d',
      ensName: '',
    },
  },
  {
    id: 'user-bruno',
    displayName: 'Bruno Costa',
    username: 'bruno.costa',
    email: 'bruno@kurio.dev',
    password: 'kurio123',
    ensName: '',
    walletNickname: 'Carteira do Bruno',
    favorites: ['golden-beat-207'],
    primaryWallet: {
      nickname: 'Coinbase do Bruno',
      network: 'polygon' as Network,
      walletType: 'coinbase' as WalletType,
      address: '0x2C4e6A8b0D1f3E5a7C9b1D3e5F7a9B0c2D4e6F81',
      ensName: '',
    },
    secondaryWallet: null,
  },
]

export const couponFixtures = [
  { code: 'KURIO10', percentOff: 10, expiresAt: '2099-12-31T23:59:59.000Z' },
  { code: 'LANCAMENTO5', percentOff: 5, expiresAt: '2099-12-31T23:59:59.000Z' },
  { code: 'EXPIRADO20', percentOff: 20, expiresAt: '2025-01-01T00:00:00.000Z' },
]

export const networkFeeEth: Record<Network, string> = {
  ethereum: '0.016',
  polygon: '0.002',
  solana: '0.001',
}
