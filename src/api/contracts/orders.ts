import { z } from 'zod'
import { walletSlotSchema, walletTypeSchema } from './account'
import { ethAmountSchema, networkSchema } from './common'
import { editionIdSchema } from './nfts'

export const createOrderRequestSchema = z.object({
  quoteId: z.string().min(1),
  walletSlot: walletSlotSchema,
  network: networkSchema,
  collector: z.object({
    displayName: z.string().trim().min(2, 'Informe seu nome de exibição.'),
    username: z.string().trim().min(3, 'Informe seu nome de usuário.'),
    email: z.email('E-mail inválido.'),
    note: z.string().max(500, 'Use no máximo 500 caracteres.').optional(),
  }),
})
export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>

export const orderStatusSchema = z.enum(['pending', 'confirmed', 'declined'])
export type OrderStatus = z.infer<typeof orderStatusSchema>

export const orderFailureReasonSchema = z.enum(['PAYMENT_DECLINED', 'OUT_OF_STOCK'])

export const receiptItemSchema = z.object({
  nftId: z.string(),
  name: z.string(),
  tokenId: z.string(),
  imageUrl: z.string(),
  editionId: editionIdSchema,
  editionLabel: z.string(),
  quantity: z.number().int(),
  unitPriceEth: ethAmountSchema,
  lineTotalEth: ethAmountSchema,
})

export const orderSchema = z.object({
  id: z.string(),
  status: orderStatusSchema,
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  failureReason: orderFailureReasonSchema.nullable(),
  receipt: z.object({
    // Hash fictício: não existe em nenhum explorer de verdade.
    transactionHash: z.string(),
    simulated: z.literal(true),
    confirmedAt: z.string().nullable(),
    network: networkSchema,
    wallet: z.object({ type: walletTypeSchema, address: z.string() }),
    items: z.array(receiptItemSchema),
    couponCode: z.string().nullable(),
    subtotalEth: ethAmountSchema,
    discountEth: ethAmountSchema,
    networkFeeEth: ethAmountSchema,
    totalEth: ethAmountSchema,
  }),
})
export type Order = z.infer<typeof orderSchema>
