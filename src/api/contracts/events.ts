import { z } from 'zod'
import { ethAmountSchema } from './common'
import { editionIdSchema } from './nfts'
import { orderFailureReasonSchema, orderStatusSchema } from './orders'

export const nftUpdatedEventSchema = z.object({
  eventId: z.string(),
  type: z.literal('nft.updated'),
  resource: z.object({ type: z.literal('nft'), id: z.string() }),
  version: z.number().int(),
  occurredAt: z.string(),
  data: z.object({
    priceEth: ethAmountSchema,
    originalPriceEth: ethAmountSchema.nullable(),
    editions: z.array(z.object({ id: editionIdSchema, stock: z.number().int() })),
  }),
})
export type NftUpdatedEvent = z.infer<typeof nftUpdatedEventSchema>

export const orderUpdatedEventSchema = z.object({
  eventId: z.string(),
  type: z.literal('order.updated'),
  resource: z.object({ type: z.literal('order'), id: z.string() }),
  version: z.number().int(),
  occurredAt: z.string(),
  data: z.object({
    status: orderStatusSchema,
    failureReason: orderFailureReasonSchema.nullable(),
  }),
})
export type OrderUpdatedEvent = z.infer<typeof orderUpdatedEventSchema>
