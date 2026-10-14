import { z } from 'zod'
import { ethAmountSchema, networkSchema } from './common'
import { editionIdSchema } from './nfts'

export const cartItemSchema = z.object({
  id: z.string(),
  nftId: z.string(),
  editionId: editionIdSchema,
  editionLabel: z.string(),
  quantity: z.number().int().min(1),
  name: z.string(),
  tokenId: z.string(),
  imageUrl: z.string(),
  unitPriceEth: ethAmountSchema,
  // Preço quando o item entrou no carrinho; se for diferente do atual, a UI avisa.
  addedPriceEth: ethAmountSchema,
  stock: z.number().int().min(0),
})
export type CartItem = z.infer<typeof cartItemSchema>

export const cartSchema = z.object({
  items: z.array(cartItemSchema),
  couponCode: z.string().nullable(),
  version: z.number().int(),
})
export type Cart = z.infer<typeof cartSchema>

const quantitySchema = z
  .number({ error: 'Quantidade inválida.' })
  .int('A quantidade precisa ser um número inteiro.')
  .min(1, 'A quantidade mínima é 1.')

export const addCartItemRequestSchema = z.object({
  nftId: z.string().min(1),
  editionId: editionIdSchema,
  quantity: quantitySchema,
})
export type AddCartItemRequest = z.infer<typeof addCartItemRequestSchema>

export const updateCartItemRequestSchema = z.object({
  quantity: quantitySchema,
})

export const applyCouponRequestSchema = z.object({
  code: z.string().trim().min(1, 'Informe o código promocional.'),
})

export const quoteRequestSchema = z.object({
  network: networkSchema,
})

export const quoteIssueSchema = z.enum(['PRICE_CHANGED', 'OUT_OF_STOCK', 'QUANTITY_EXCEEDS_STOCK'])
export type QuoteIssue = z.infer<typeof quoteIssueSchema>

export const quoteLineSchema = z.object({
  itemId: z.string(),
  nftId: z.string(),
  editionId: editionIdSchema,
  quantity: z.number().int(),
  unitPriceEth: ethAmountSchema,
  lineTotalEth: ethAmountSchema,
  issues: z.array(quoteIssueSchema),
})

export const quoteSchema = z.object({
  id: z.string(),
  cartVersion: z.number().int(),
  network: networkSchema,
  expiresAt: z.string(),
  valid: z.boolean(),
  lines: z.array(quoteLineSchema),
  coupon: z.object({ code: z.string(), percentOff: z.number() }).nullable(),
  subtotalEth: ethAmountSchema,
  discountEth: ethAmountSchema,
  networkFeeEth: ethAmountSchema,
  totalEth: ethAmountSchema,
})
export type Quote = z.infer<typeof quoteSchema>
