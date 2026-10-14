import { HttpResponse } from 'msw'
import type { z } from 'zod'
import type { ErrorCode } from '@/api/contracts/common'
import { getDb, toPublicUser } from './db'

export function errorResponse(
  status: number,
  code: ErrorCode,
  message: string,
  extra: { fields?: Record<string, string>; details?: unknown } = {},
) {
  return HttpResponse.json({ error: { code, message, ...extra } }, { status })
}

export function notFound(message = 'Recurso não encontrado.') {
  return errorResponse(404, 'NOT_FOUND', message)
}

export function validationError(error: z.ZodError) {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const field = issue.path.join('.') || 'body'
    fields[field] ??= issue.message
  }
  return errorResponse(422, 'VALIDATION_ERROR', 'Confira os campos destacados.', { fields })
}

// Lê e valida o corpo com o mesmo schema zod que o front usa.
export async function readBody<Schema extends z.ZodType>(request: Request, schema: Schema) {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return {
      body: undefined,
      response: errorResponse(400, 'BAD_REQUEST', 'Corpo da requisição inválido.'),
    }
  }

  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    return { body: undefined, response: validationError(parsed.error) }
  }
  return { body: parsed.data as z.output<Schema>, response: undefined }
}

function readToken(request: Request) {
  const header = request.headers.get('Authorization')
  return header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null
}

export function findSessionUser(request: Request) {
  const token = readToken(request)
  if (!token) return null

  const db = getDb()
  const session = db.sessions.find((item) => item.token === token)
  if (!session || session.expiresAt <= Date.now()) return null

  return db.users.find((user) => user.id === session.userId) ?? null
}

export function requireUser(request: Request) {
  const token = readToken(request)
  if (!token) {
    return { response: errorResponse(401, 'UNAUTHENTICATED', 'Faça login para continuar.') }
  }

  const db = getDb()
  const session = db.sessions.find((item) => item.token === token)
  if (!session) {
    return { response: errorResponse(401, 'UNAUTHENTICATED', 'Sessão inválida.') }
  }
  if (session.expiresAt <= Date.now()) {
    return {
      response: errorResponse(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.'),
    }
  }

  const user = db.users.find((item) => item.id === session.userId)!
  return { user, session, publicUser: toPublicUser(user), response: undefined }
}
