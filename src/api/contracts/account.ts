import { z } from 'zod'
import { passwordSchema, usernameSchema } from './auth'
import { networkSchema } from './common'

export const updateProfileRequestSchema = z.object({
  displayName: z.string().trim().min(2, 'Informe seu nome de exibição.'),
  username: usernameSchema,
  email: z.email('E-mail inválido.'),
  ensName: z
    .string()
    .trim()
    .regex(/^([a-z0-9-]{3,}\.eth)?$/, 'Use um nome ENS válido, como "colecionador.eth".'),
  walletNickname: z.string().trim().min(2, 'Informe um apelido para a carteira.'),
})
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>

const MAX_AVATAR_BYTES = 1024 * 1024

export const updateAvatarRequestSchema = z.object({
  imageDataUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|webp);base64,/, 'Envie uma imagem PNG, JPEG ou WebP.')
    // base64 ocupa ~4/3 do tamanho real do arquivo
    .refine((value) => value.length * 0.75 <= MAX_AVATAR_BYTES, 'A imagem precisa ter até 1 MB.'),
})

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual.'),
  newPassword: passwordSchema,
})

export const walletTypeSchema = z.enum(['metamask', 'walletconnect', 'coinbase'])
export type WalletType = z.infer<typeof walletTypeSchema>

export const walletSlotSchema = z.enum(['primary', 'secondary'])
export type WalletSlot = z.infer<typeof walletSlotSchema>

const evmAddress = /^0x[a-fA-F0-9]{40}$/
const solanaAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

export const saveWalletRequestSchema = z
  .object({
    nickname: z.string().trim().min(2, 'Informe um apelido para a carteira.'),
    network: networkSchema,
    walletType: walletTypeSchema,
    address: z.string().trim().min(1, 'Informe o endereço da carteira.'),
    ensName: z
      .string()
      .trim()
      .regex(/^([a-z0-9-]{3,}\.eth)?$/, 'Use um nome ENS válido, como "colecionador.eth".')
      .default(''),
  })
  .superRefine((wallet, ctx) => {
    const pattern = wallet.network === 'solana' ? solanaAddress : evmAddress
    if (!pattern.test(wallet.address)) {
      ctx.addIssue({
        code: 'custom',
        path: ['address'],
        message:
          wallet.network === 'solana'
            ? 'Endereço Solana inválido.'
            : 'O endereço precisa começar com 0x e ter 40 caracteres hexadecimais.',
      })
    }
  })
export type SaveWalletRequest = z.input<typeof saveWalletRequestSchema>

export const walletSchema = z.object({
  slot: walletSlotSchema,
  nickname: z.string(),
  network: networkSchema,
  walletType: walletTypeSchema,
  address: z.string(),
  ensName: z.string(),
  updatedAt: z.string(),
})
export type Wallet = z.infer<typeof walletSchema>

export const walletsResponseSchema = z.object({
  primary: walletSchema.nullable(),
  secondary: walletSchema.nullable(),
})
export type WalletsResponse = z.infer<typeof walletsResponseSchema>

export const connectWalletRequestSchema = z.object({
  network: networkSchema,
  // App usado para conectar; precisa ser o mesmo em que a carteira foi cadastrada.
  walletType: walletTypeSchema.optional(),
})

export const walletConnectionSchema = z.object({
  slot: walletSlotSchema,
  connected: z.boolean(),
  address: z.string(),
  network: networkSchema,
})
export type WalletConnection = z.infer<typeof walletConnectionSchema>
