import { realtimeHandler } from '../realtime/connections'
import { mockControlHandlers } from './mock-control'
import { nftHandlers } from './nfts'

export const handlers = [...nftHandlers, ...mockControlHandlers, realtimeHandler]
