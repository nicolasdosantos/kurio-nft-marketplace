import { http, HttpResponse } from 'msw'
import {
  changePasswordRequestSchema,
  connectWalletRequestSchema,
  saveWalletRequestSchema,
  updateAvatarRequestSchema,
  updateProfileRequestSchema,
  walletSlotSchema,
  type WalletSlot,
} from '@/api/contracts/account'
import { getDb, saveDb, toPublicUser } from '../db'
import { hashPassword } from '../password'
import { errorResponse, notFound, readBody, requireUser } from '../responses'
import { getScenario } from '../scenarios'

function walletsOf(userId: string) {
  const db = getDb()
  db.wallets[userId] ??= { primary: null, secondary: null, connected: {} }
  return db.wallets[userId]
}

function parseSlot(slot: unknown) {
  const parsed = walletSlotSchema.safeParse(slot)
  return parsed.success ? parsed.data : null
}

export const accountHandlers = [
  http.get('/api/profile', ({ request }) => {
    const auth = requireUser(request)
    if (auth.response) return auth.response
    return HttpResponse.json(auth.publicUser)
  }),

  http.patch('/api/profile', async ({ request }) => {
    const auth = requireUser(request)
    if (auth.response) return auth.response
    const parsed = await readBody(request, updateProfileRequestSchema)
    if (parsed.response) return parsed.response

    const db = getDb()
    const email = parsed.body.email.toLowerCase()
    const others = db.users.filter((user) => user.id !== auth.user.id)
    if (others.some((user) => user.email === email)) {
      return errorResponse(409, 'EMAIL_TAKEN', 'Este e-mail já está em uso.', {
        fields: { email: 'Este e-mail já está em uso.' },
      })
    }
    if (others.some((user) => user.username === parsed.body.username)) {
      return errorResponse(409, 'USERNAME_TAKEN', 'Este nome de usuário já está em uso.', {
        fields: { username: 'Este nome de usuário já está em uso.' },
      })
    }

    Object.assign(auth.user, { ...parsed.body, email })
    saveDb()
    return HttpResponse.json(toPublicUser(auth.user))
  }),

  http.put('/api/profile/avatar', async ({ request }) => {
    const auth = requireUser(request)
    if (auth.response) return auth.response
    const parsed = await readBody(request, updateAvatarRequestSchema)
    if (parsed.response) return parsed.response

    auth.user.avatarUrl = parsed.body.imageDataUrl
    saveDb()
    return HttpResponse.json(toPublicUser(auth.user))
  }),

  http.delete('/api/profile/avatar', ({ request }) => {
    const auth = requireUser(request)
    if (auth.response) return auth.response

    auth.user.avatarUrl = null
    saveDb()
    return HttpResponse.json(toPublicUser(auth.user))
  }),

  http.put('/api/profile/password', async ({ request }) => {
    const auth = requireUser(request)
    if (auth.response) return auth.response
    const parsed = await readBody(request, changePasswordRequestSchema)
    if (parsed.response) return parsed.response

    const currentHash = await hashPassword(parsed.body.currentPassword, auth.user.passwordSalt)
    if (currentHash !== auth.user.passwordHash) {
      return errorResponse(422, 'WRONG_PASSWORD', 'A senha atual está incorreta.', {
        fields: { currentPassword: 'A senha atual está incorreta.' },
      })
    }

    auth.user.passwordHash = await hashPassword(parsed.body.newPassword, auth.user.passwordSalt)
    saveDb()
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('/api/wallets', ({ request }) => {
    const auth = requireUser(request)
    if (auth.response) return auth.response

    const wallets = walletsOf(auth.user.id)
    return HttpResponse.json({ primary: wallets.primary, secondary: wallets.secondary })
  }),

  http.put('/api/wallets/:slot', async ({ request, params }) => {
    const auth = requireUser(request)
    if (auth.response) return auth.response
    const slot = parseSlot(params.slot)
    if (!slot) return notFound('Carteira não encontrada.')
    const parsed = await readBody(request, saveWalletRequestSchema)
    if (parsed.response) return parsed.response

    const wallets = walletsOf(auth.user.id)
    if (slot === 'secondary' && !wallets.primary) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Cadastre a carteira principal primeiro.', {
        fields: { slot: 'Cadastre a carteira principal primeiro.' },
      })
    }

    wallets[slot] = { slot, ...parsed.body, updatedAt: new Date().toISOString() }
    // Mudou a carteira: a conexão anterior não vale mais.
    delete wallets.connected[slot]
    saveDb()
    return HttpResponse.json(wallets[slot])
  }),

  http.delete('/api/wallets/secondary', ({ request }) => {
    const auth = requireUser(request)
    if (auth.response) return auth.response

    const wallets = walletsOf(auth.user.id)
    wallets.secondary = null
    delete wallets.connected.secondary
    saveDb()
    return new HttpResponse(null, { status: 204 })
  }),

  http.post('/api/wallets/:slot/connect', async ({ request, params }) => {
    const auth = requireUser(request)
    if (auth.response) return auth.response
    const slot = parseSlot(params.slot)
    if (!slot) return notFound('Carteira não encontrada.')
    const parsed = await readBody(request, connectWalletRequestSchema)
    if (parsed.response) return parsed.response

    const wallets = walletsOf(auth.user.id)
    const wallet = wallets[slot]
    if (!wallet) return notFound('Cadastre esta carteira antes de conectar.')
    if (wallet.network !== parsed.body.network) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Esta carteira é de outra rede.', {
        fields: { network: 'Esta carteira é de outra rede.' },
      })
    }
    if (getScenario().name === 'wallet-rejected') {
      return errorResponse(409, 'WALLET_REJECTED', 'A conexão foi recusada na carteira.')
    }

    wallets.connected[slot] = parsed.body.network
    saveDb()
    return HttpResponse.json({
      slot,
      connected: true,
      address: wallet.address,
      network: wallet.network,
    })
  }),

  http.post('/api/wallets/:slot/disconnect', ({ request, params }) => {
    const auth = requireUser(request)
    if (auth.response) return auth.response
    const slot: WalletSlot | null = parseSlot(params.slot)
    if (!slot) return notFound('Carteira não encontrada.')

    delete walletsOf(auth.user.id).connected[slot]
    saveDb()
    return new HttpResponse(null, { status: 204 })
  }),
]
