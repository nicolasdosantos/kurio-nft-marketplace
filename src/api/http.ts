import axios from 'axios'
import { clearSession, getGuestCartId, getSession } from '@/session/session-store'
import { toApiRequestError } from './errors'

export const http = axios.create({
  baseURL: '/api',
  timeout: 10_000,
  // collection=a&collection=b, no formato que a API espera.
  paramsSerializer: { indexes: null },
})

http.interceptors.request.use((config) => {
  const { token } = getSession()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  } else {
    config.headers['X-Cart-Id'] = getGuestCartId()
  }
  return config
})

let handleSessionExpired: () => void = () => {}

// O app registra aqui o que fazer (limpar cache e ir para o login).
export function onSessionExpired(handler: () => void) {
  handleSessionExpired = handler
}

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const apiError = toApiRequestError(error)
    if (apiError.code === 'SESSION_EXPIRED' && getSession().user) {
      clearSession()
      handleSessionExpired()
    }
    return Promise.reject(apiError)
  },
)
