import { http, HttpResponse } from 'msw'
import { loginRequestSchema, registerRequestSchema } from '@/api/contracts/auth'
import { mergeGuestCart } from '../cart-logic'
import { getDb, saveDb, toPublicUser, type StoredUser } from '../db'
import { createSalt, hashPassword } from '../password'
import { closeConnectionsForToken } from '../realtime/connections'
import { errorResponse, readBody, requireUser } from '../responses'

const SESSION_DURATION_MS = 30 * 60 * 1000

function startSession(user: StoredUser) {
  const db = getDb()
  const session = {
    token: crypto.randomUUID(),
    userId: user.id,
    expiresAt: Date.now() + SESSION_DURATION_MS,
  }
  db.sessions.push(session)
  return {
    token: session.token,
    expiresAt: new Date(session.expiresAt).toISOString(),
    user: toPublicUser(user),
  }
}

export const authHandlers = [
  http.post('/api/auth/register', async ({ request }) => {
    const { body, response } = await readBody(request, registerRequestSchema)
    if (response) return response

    const db = getDb()
    const email = body.email.toLowerCase()
    if (db.users.some((user) => user.email === email)) {
      return errorResponse(409, 'EMAIL_TAKEN', 'Este e-mail já está em uso.', {
        fields: { email: 'Este e-mail já está em uso.' },
      })
    }
    if (db.users.some((user) => user.username === body.username)) {
      return errorResponse(409, 'USERNAME_TAKEN', 'Este nome de usuário já está em uso.', {
        fields: { username: 'Este nome de usuário já está em uso.' },
      })
    }

    const passwordSalt = createSalt()
    const user: StoredUser = {
      id: `user-${crypto.randomUUID()}`,
      displayName: body.displayName,
      username: body.username,
      email,
      ensName: '',
      walletNickname: '',
      avatarUrl: null,
      passwordSalt,
      passwordHash: await hashPassword(body.password, passwordSalt),
    }
    db.users.push(user)
    db.favorites[user.id] = []
    db.wallets[user.id] = { primary: null, secondary: null, connected: {} }

    if (body.guestCartId) mergeGuestCart(body.guestCartId, user.id)

    const auth = startSession(user)
    saveDb()
    return HttpResponse.json(auth, { status: 201 })
  }),

  http.post('/api/auth/login', async ({ request }) => {
    const { body, response } = await readBody(request, loginRequestSchema)
    if (response) return response

    const db = getDb()
    const user = db.users.find((item) => item.email === body.email.toLowerCase())
    const passwordHash = user ? await hashPassword(body.password, user.passwordSalt) : null

    if (!user || passwordHash !== user.passwordHash) {
      return errorResponse(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.')
    }

    if (body.guestCartId) mergeGuestCart(body.guestCartId, user.id)

    const auth = startSession(user)
    saveDb()
    return HttpResponse.json(auth)
  }),

  http.get('/api/auth/session', ({ request }) => {
    const auth = requireUser(request)
    if (auth.response) return auth.response

    return HttpResponse.json({
      user: auth.publicUser,
      expiresAt: new Date(auth.session.expiresAt).toISOString(),
    })
  }),

  http.post('/api/auth/logout', ({ request }) => {
    const db = getDb()
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (token) {
      db.sessions = db.sessions.filter((session) => session.token !== token)
      closeConnectionsForToken(token)
      saveDb()
    }
    return new HttpResponse(null, { status: 204 })
  }),
]
