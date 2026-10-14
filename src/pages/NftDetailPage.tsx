import { useState } from 'react'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { useAddToCart } from '@/api/cart'
import { useNft } from '@/api/catalog'
import type { EditionId } from '@/api/contracts/nfts'
import { ApiRequestError } from '@/api/errors'
import { useFavorites, useToggleFavorite } from '@/api/favorites'
import { useSession } from '@/session/session-store'

export function NftDetailPage({ nftId }: { nftId: string }) {
  const nftQuery = useNft(nftId)
  const session = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const favoritesQuery = useFavorites()
  const toggleFavorite = useToggleFavorite()
  const addToCart = useAddToCart()

  const [chosenEditionId, setChosenEditionId] = useState<EditionId | null>(null)
  const [quantity, setQuantity] = useState(1)

  if (nftQuery.isPending) return <main className="p-4">Carregando NFT...</main>

  if (nftQuery.isError) {
    const notFound = nftQuery.error instanceof ApiRequestError && nftQuery.error.status === 404
    return (
      <main className="flex flex-col gap-3 p-4">
        <h1 className="text-heading font-bold">
          {notFound ? 'NFT não encontrado' : 'Não foi possível carregar o NFT'}
        </h1>
        {!notFound && (
          <button type="button" onClick={() => nftQuery.refetch()} className="underline">
            Tentar de novo
          </button>
        )}
        <Link to="/" className="underline">
          Voltar para o mercado
        </Link>
      </main>
    )
  }

  const nft = nftQuery.data
  const firstAvailable = nft.editions.find((edition) => edition.stock > 0)
  const edition =
    nft.editions.find((item) => item.id === chosenEditionId && item.stock > 0) ?? firstAvailable
  const maxQuantity = edition ? Math.min(edition.stock, edition.maxPerOrder) : 0
  const safeQuantity = Math.min(quantity, Math.max(maxQuantity, 1))
  const isFavorite = favoritesQuery.data?.nftIds.includes(nft.id) ?? false

  function handleFavoriteClick() {
    if (!session.user) {
      navigate({ to: '/login', search: { redirect: location.href } })
      return
    }
    toggleFavorite.mutate({ nftId: nft.id, favorite: !isFavorite })
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <Link to="/" className="underline">
        Voltar para o mercado
      </Link>
      <img
        src={nft.imageUrl}
        alt={`Arte do NFT ${nft.name}`}
        width={320}
        height={320}
        className="rounded"
      />
      <h1 className="text-heading font-bold">{nft.name}</h1>
      <p className="text-body-lg text-text-accent" data-testid="nft-price">
        {nft.priceEth} ETH
        {nft.originalPriceEth && (
          <s className="ml-2 text-text-secondary">{nft.originalPriceEth} ETH</s>
        )}
      </p>
      <p>{nft.description}</p>
      <p>
        Coleção: {nft.collection.name} · ID do token: {nft.tokenId}
      </p>

      <fieldset>
        <legend className="font-bold">Edição</legend>
        <div className="flex gap-3">
          {nft.editions.map((item) => (
            <label key={item.id} className="flex gap-1">
              <input
                type="radio"
                name="edition"
                value={item.id}
                checked={edition?.id === item.id}
                disabled={item.stock === 0}
                onChange={() => {
                  setChosenEditionId(item.id)
                  setQuantity(1)
                }}
              />
              {item.label}
              {item.stock === 0 && ' (esgotada)'}
            </label>
          ))}
        </div>
      </fieldset>

      {edition ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Diminuir quantidade"
            disabled={safeQuantity <= 1}
            onClick={() => setQuantity(safeQuantity - 1)}
            className="rounded border px-2"
          >
            −
          </button>
          <span aria-live="polite" data-testid="quantity">
            {safeQuantity}
          </span>
          <button
            type="button"
            aria-label="Aumentar quantidade"
            disabled={safeQuantity >= maxQuantity}
            onClick={() => setQuantity(safeQuantity + 1)}
            className="rounded border px-2"
          >
            +
          </button>
          <span className="text-body-sm text-text-secondary">máximo {maxQuantity}</span>
        </div>
      ) : (
        <p>Todas as edições estão esgotadas.</p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={!edition || addToCart.isPending}
          onClick={() =>
            edition &&
            addToCart.mutate({ nftId: nft.id, editionId: edition.id, quantity: safeQuantity })
          }
          className="rounded bg-primary px-3 py-1 text-primary-foreground disabled:opacity-50"
        >
          Comprar
        </button>
        <button
          type="button"
          aria-pressed={isFavorite}
          onClick={handleFavoriteClick}
          className="rounded border border-primary px-3 py-1"
        >
          {isFavorite ? 'Favoritado' : 'Favoritar'}
        </button>
      </div>

      <div role="status" aria-live="polite" className="text-body-sm">
        {addToCart.isSuccess && 'Adicionado ao carrinho.'}
        {addToCart.isError && <span className="text-destructive">{addToCart.error.message}</span>}
        {toggleFavorite.isError && (
          <span className="text-destructive">
            Não foi possível atualizar o favorito. Tente de novo.
          </span>
        )}
      </div>
    </main>
  )
}
