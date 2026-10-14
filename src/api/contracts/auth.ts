import { z } from 'zod'

export const userSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  username: z.string(),
  email: z.email(),
  ensName: z.string(),
  walletNickname: z.string(),
  avatarUrl: z.string().nullable(),
})
export type User = z.infer<typeof userSchema>

export const passwordSchema = z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.')

export const usernameSchema = z
  .string()
  .min(3, 'Use pelo menos 3 caracteres.')
  .max(24, 'Use no máximo 24 caracteres.')
  .regex(/^[a-z0-9_.]+$/, 'Use só letras minúsculas, números, ponto e underline.')

export const registerRequestSchema = z.object({
  displayName: z.string().trim().min(2, 'Informe seu nome de exibição.'),
  username: usernameSchema,
  email: z.email('E-mail inválido.'),
  password: passwordSchema,
  guestCartId: z.string().optional(),
})
export type RegisterRequest = z.infer<typeof registerRequestSchema>

export const loginRequestSchema = z.object({
  email: z.email('E-mail inválido.'),
  password: z.string().min(1, 'Informe a senha.'),
  guestCartId: z.string().optional(),
})
export type LoginRequest = z.infer<typeof loginRequestSchema>

export const authResponseSchema = z.object({
  token: z.string(),
  expiresAt: z.string(),
  user: userSchema,
})
export type AuthResponse = z.infer<typeof authResponseSchema>

export const sessionResponseSchema = z.object({
  user: userSchema,
  expiresAt: z.string(),
})
export type SessionResponse = z.infer<typeof sessionResponseSchema>
