import { useState } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { useFavorites, useToggleFavorite } from '@/api/favorites'
import { cn } from '@/lib/utils'
import { useSession } from '@/session/session-store'

interface FavoriteButtonProps {
  nftId: string
  nftName: string
  className?: string
}

export function FavoriteButton({ nftId, nftName, className }: FavoriteButtonProps) {
  const session = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const favoritesQuery = useFavorites()
  const toggleFavorite = useToggleFavorite()
  const isFavorite = favoritesQuery.data?.nftIds.includes(nftId) ?? false
  // O "pulo" é só para o clique que favorita, não para os favoritos que já vêm da API.
  const [popped, setPopped] = useState(false)

  function handleClick() {
    if (!session.user) {
      navigate({ to: '/login', search: { redirect: location.href } })
      return
    }
    setPopped(!isFavorite)
    toggleFavorite.mutate({ nftId, favorite: !isFavorite })
  }

  return (
    <button
      type="button"
      aria-pressed={isFavorite}
      aria-label={isFavorite ? `Remover ${nftName} dos favoritos` : `Favoritar ${nftName}`}
      onClick={handleClick}
      className={cn(
        'relative z-10 size-7 rounded-full',
        popped && isFavorite && 'heart-burst',
        className,
      )}
    >
      <img
        src={isFavorite ? '/icons/favorite-button-alt.svg' : '/icons/favorite-button.svg'}
        alt=""
        width={28}
        height={28}
        onAnimationEnd={() => setPopped(false)}
        className={cn(popped && isFavorite && 'animate-pop')}
      />
    </button>
  )
}
