import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  clearSession,
  getGuestCartId,
  getSession,
  setSession,
  startNewGuestCart,
} from '@/session/session-store'
import type { AuthResponse, LoginRequest, RegisterRequest, SessionResponse } from './contracts/auth'
import { http } from './http'

// Chamado antes do primeiro render: se o token salvo ainda vale, recupera o usuário.
export async function restoreSession() {
  const { token } = getSession()
  if (!token) return

  try {
    const response = await http.get<SessionResponse>('/auth/session')
    setSession(token, response.data.user)
  } catch {
    clearSession()
  }
}

// Trocar de usuário (ou sair) não pode deixar nada do anterior no cache.
function useStartFreshSession() {
  const queryClient = useQueryClient()
  return (auth: AuthResponse | null) => {
    queryClient.cancelQueries()
    queryClient.removeQueries()
    if (auth) setSession(auth.token, auth.user)
    else clearSession()
  }
}

export function useLogin() {
  const startFreshSession = useStartFreshSession()
  return useMutation({
    mutationFn: async (credentials: Omit<LoginRequest, 'guestCartId'>) => {
      const response = await http.post<AuthResponse>('/auth/login', {
        ...credentials,
        guestCartId: getGuestCartId(),
      })
      return response.data
    },
    onSuccess: (auth) => startFreshSession(auth),
  })
}

export function useRegister() {
  const startFreshSession = useStartFreshSession()
  return useMutation({
    mutationFn: async (account: Omit<RegisterRequest, 'guestCartId'>) => {
      const response = await http.post<AuthResponse>('/auth/register', {
        ...account,
        guestCartId: getGuestCartId(),
      })
      return response.data
    },
    onSuccess: (auth) => startFreshSession(auth),
  })
}

export function useLogout() {
  const startFreshSession = useStartFreshSession()
  return useMutation({
    mutationFn: async () => {
      // Mesmo se a API falhar, a sessão local precisa acabar.
      await http.post('/auth/logout').catch(() => undefined)
    },
    onSettled: () => {
      startNewGuestCart()
      startFreshSession(null)
    },
  })
}
