import { delay, http, HttpResponse } from 'msw'
import type { ApiError, Nft } from '@/api/types'
import { findNft } from '../db'

export const nftHandlers = [
  http.get<{ nftId: string }, never, Nft | ApiError>('/api/nfts/:nftId', async ({ params }) => {
    await delay(300)

    const nft = findNft(params.nftId)
    if (!nft) {
      return HttpResponse.json(
        { code: 'NOT_FOUND', message: 'NFT não encontrado.' },
        { status: 404 },
      )
    }
    return HttpResponse.json(nft)
  }),
]
