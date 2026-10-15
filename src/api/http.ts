import axios from 'axios'
import { mocksReady } from '@/lib/mocks-ready'
import {
  clearSession,
  getGuestCartId,
  getSession,
  waitForSessionRestore,
} from '@/session/session-store'
import { toApiRequestError } from './errors'

export const http = axios.create({
  baseURL: '/api',
  timeout: 10_000,
  // collection=a&collection=b, no formato que a API espera.
  paramsSerializer: { indexes: null },
})

http.interceptors.request.use(async (config) => {
  await mocksReady
  // Só depois de saber quem é o usuário o token (ou o carrinho de visitante) é lido.
  // A própria consulta da sessão não pode esperar por ela mesma.
  if (config.url !== '/auth/session') await waitForSessionRestore()

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
