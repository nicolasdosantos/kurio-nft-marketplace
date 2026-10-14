import { isAxiosError } from 'axios'
import { apiErrorSchema, type ErrorCode } from './contracts/common'

export type ClientErrorCode = ErrorCode | 'NETWORK_ERROR' | 'TIMEOUT' | 'UNKNOWN'

// Formato único de erro para a UI, venha de onde vier.
export class ApiRequestError extends Error {
  status: number
  code: ClientErrorCode
  fields: Record<string, string>
  details: unknown

  constructor(options: {
    status: number
    code: ClientErrorCode
    message: string
    fields?: Record<string, string>
    details?: unknown
  }) {
    super(options.message)
    this.name = 'ApiRequestError'
    this.status = options.status
    this.code = options.code
    this.fields = options.fields ?? {}
    this.details = options.details
  }
}

export function toApiRequestError(error: unknown): ApiRequestError {
  if (error instanceof ApiRequestError) return error

  if (isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ApiRequestError({
        status: 0,
        code: 'TIMEOUT',
        message: 'O servidor demorou para responder. Tente de novo.',
      })
    }
    if (!error.response) {
      return new ApiRequestError({
        status: 0,
        code: 'NETWORK_ERROR',
        message: 'Sem conexão com o servidor. Verifique sua internet.',
      })
    }

    const parsed = apiErrorSchema.safeParse(error.response.data)
    if (parsed.success) {
      return new ApiRequestError({ status: error.response.status, ...parsed.data.error })
    }
    return new ApiRequestError({
      status: error.response.status,
      code: 'UNKNOWN',
      message: 'Algo deu errado. Tente de novo.',
    })
  }

  return new ApiRequestError({ status: 0, code: 'UNKNOWN', message: 'Algo deu errado.' })
}

export function isRetryableError(error: unknown) {
  const apiError = toApiRequestError(error)
  return apiError.status === 0 || apiError.status >= 500
}
