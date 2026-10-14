import { realtimeHandler } from '../realtime/connections'
import { accountHandlers } from './account'
import { authHandlers } from './auth'
import { cartHandlers } from './cart'
import { favoriteHandlers } from './favorites'
import { mockControlHandlers } from './mock-control'
import { networkConditionsHandler } from './network-conditions'
import { nftHandlers } from './nfts'
import { orderHandlers } from './orders'

// A ordem importa: as condições de rede rodam antes de qualquer rota.
export const handlers = [
  networkConditionsHandler,
  ...mockControlHandlers,
  ...authHandlers,
  ...nftHandlers,
  ...favoriteHandlers,
  ...cartHandlers,
  ...orderHandlers,
  ...accountHandlers,
  realtimeHandler,
]
