import { z } from 'zod'

// ETH trafega sempre como string decimal ("1.99"), nunca como number.
export const ethAmountSchema = z.string().regex(/^\d+(\.\d+)?$/, 'Valor em ETH inválido.')

export const networkSchema = z.enum(['ethereum', 'polygon', 'solana'])
export type Network = z.infer<typeof networkSchema>

export const errorCodeSchema = z.enum([
  'BAD_REQUEST',
  'VALIDATION_ERROR',
  'COUPON_INVALID',
  'COUPON_EXPIRED',
  'WRONG_PASSWORD',
  'UNAUTHENTICATED',
  'SESSION_EXPIRED',
  'INVALID_CREDENTIALS',
  'FORBIDDEN',
  'NOT_FOUND',
  'EMAIL_TAKEN',
  'USERNAME_TAKEN',
  'OUT_OF_STOCK',
  'QUOTE_OUTDATED',
  'IDEMPOTENCY_CONFLICT',
  'WALLET_REJECTED',
  'WALLET_DISCONNECTED',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
])
export type ErrorCode = z.infer<typeof errorCodeSchema>

export const apiErrorSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    fields: z.record(z.string(), z.string()).optional(),
    details: z.unknown().optional(),
  }),
})
export type ApiError = z.infer<typeof apiErrorSchema>
