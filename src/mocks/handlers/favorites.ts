import { http, HttpResponse } from 'msw'
import { findNft, getDb, saveDb } from '../db'
import { notFound, requireUser } from '../responses'

export const favoriteHandlers = [
  http.get('/api/favorites', ({ request }) => {
    const auth = requireUser(request)
    if (auth.response) return auth.response

    return HttpResponse.json({ nftIds: getDb().favorites[auth.user.id] ?? [] })
  }),

  http.put('/api/favorites/:nftId', ({ request, params }) => {
    const auth = requireUser(request)
    if (auth.response) return auth.response

    const nftId = String(params.nftId)
    if (!findNft(nftId)) return notFound('NFT não encontrado.')

    const db = getDb()
    const favorites = db.favorites[auth.user.id] ?? []
    if (!favorites.includes(nftId)) favorites.push(nftId)
    db.favorites[auth.user.id] = favorites
    saveDb()
    return new HttpResponse(null, { status: 204 })
  }),

  http.delete('/api/favorites/:nftId', ({ request, params }) => {
    const auth = requireUser(request)
    if (auth.response) return auth.response

    const db = getDb()
    db.favorites[auth.user.id] = (db.favorites[auth.user.id] ?? []).filter(
      (nftId) => nftId !== params.nftId,
    )
    saveDb()
    return new HttpResponse(null, { status: 204 })
  }),
]
