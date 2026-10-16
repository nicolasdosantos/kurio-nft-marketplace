import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cacheOwner, updateSessionUser, useSession } from '@/session/session-store'
import type {
  SaveWalletRequest,
  UpdateProfileRequest,
  Wallet,
  WalletConnection,
  WalletSlot,
  WalletsResponse,
  WalletType,
} from './contracts/account'
import type { User } from './contracts/auth'
import type { Network } from './contracts/common'
import { http } from './http'
import { queryKeys } from './query-keys'

export function useProfile() {
  const session = useSession()
  return useQuery({
    queryKey: queryKeys.profile(cacheOwner(session)),
    queryFn: async ({ signal }) => {
      const response = await http.get<User>('/profile', { signal })
      return response.data
    },
    enabled: session.user !== null,
  })
}

function useProfileMutation<Variables>(request: (variables: Variables) => Promise<User>) {
  const queryClient = useQueryClient()
  const owner = cacheOwner(useSession())

  return useMutation({
    mutationFn: request,
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.profile(owner), user)
      updateSessionUser(user)
    },
  })
}

export function useUpdateProfile() {
  return useProfileMutation(async (profile: UpdateProfileRequest) => {
    const response = await http.patch<User>('/profile', profile)
    return response.data
  })
}

export function useUpdateAvatar() {
  return useProfileMutation(async (imageDataUrl: string) => {
    const response = await http.put<User>('/profile/avatar', { imageDataUrl })
    return response.data
  })
}

export function useRemoveAvatar() {
  return useProfileMutation(async () => {
    const response = await http.delete<User>('/profile/avatar')
    return response.data
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (passwords: { currentPassword: string; newPassword: string }) => {
      await http.put('/profile/password', passwords)
    },
  })
}

export function useWallets() {
  const session = useSession()
  return useQuery({
    queryKey: queryKeys.wallets(cacheOwner(session)),
    queryFn: async ({ signal }) => {
      const response = await http.get<WalletsResponse>('/wallets', { signal })
      return response.data
    },
    enabled: session.user !== null,
  })
}

function useInvalidateWallets() {
  const queryClient = useQueryClient()
  const owner = cacheOwner(useSession())
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.wallets(owner) })
}

export function useSaveWallet() {
  const invalidateWallets = useInvalidateWallets()
  return useMutation({
    mutationFn: async ({ slot, wallet }: { slot: WalletSlot; wallet: SaveWalletRequest }) => {
      const response = await http.put<Wallet>(`/wallets/${slot}`, wallet)
      return response.data
    },
    onSuccess: invalidateWallets,
  })
}

export function useRemoveSecondaryWallet() {
  const invalidateWallets = useInvalidateWallets()
  return useMutation({
    mutationFn: async () => {
      await http.delete('/wallets/secondary')
    },
    onSuccess: invalidateWallets,
  })
}

export function useConnectWallet() {
  return useMutation({
    mutationFn: async ({
      slot,
      network,
      walletType,
    }: {
      slot: WalletSlot
      network: Network
      walletType: WalletType
    }) => {
      const response = await http.post<WalletConnection>(`/wallets/${slot}/connect`, {
        network,
        walletType,
      })
      return response.data
    },
  })
}

export function useDisconnectWallet() {
  return useMutation({
    mutationFn: async (slot: WalletSlot) => {
      await http.post(`/wallets/${slot}/disconnect`)
    },
  })
}
