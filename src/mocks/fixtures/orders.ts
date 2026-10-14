import type { StoredOrder } from '../db'

// Um pedido antigo e já confirmado da Ana, para testar isolamento entre usuários.
export function buildSeedOrders(): StoredOrder[] {
  const createdAt = '2026-07-29T15:20:00.000Z'

  return [
    {
      id: 'order-ana-0001',
      userId: 'user-ana',
      idempotencyKey: 'seed-order-ana-0001',
      requestFingerprint: 'seed',
      plannedOutcome: 'confirmed',
      settleAt: Date.parse(createdAt),
      status: 'confirmed',
      version: 2,
      createdAt,
      updatedAt: createdAt,
      failureReason: null,
      receipt: {
        transactionHash: '0xa91f6c0b3d2e8f4a7c1b9d5e3f7a2c4b6d8e0f1a3c5b7d9e2f4a6c8b0d1e82c',
        simulated: true,
        confirmedAt: createdAt,
        network: 'ethereum',
        wallet: { type: 'metamask', address: '0xA91F5c3D7e2B8a4C6d0E1f9B3a5C7e2D4f6AE82C' },
        items: [
          {
            nftId: 'emerald-ape-042',
            name: 'Emerald Ape #042',
            tokenId: '#0042',
            imageUrl: '/nfts/emerald-800.webp',
            editionId: '1-50',
            editionLabel: '1/50',
            quantity: 2,
            unitPriceEth: '1.19',
            lineTotalEth: '2.38',
          },
        ],
        couponCode: null,
        subtotalEth: '2.38',
        discountEth: '0',
        networkFeeEth: '0.016',
        totalEth: '2.396',
      },
    },
  ]
}
