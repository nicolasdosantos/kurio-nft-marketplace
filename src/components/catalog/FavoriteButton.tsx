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

  function handleClick() {
    if (!session.user) {
      navigate({ to: '/login', search: { redirect: location.href } })
      return
    }
    toggleFavorite.mutate({ nftId, favorite: !isFavorite })
  }

  return (
    <button
      type="button"
      aria-pressed={isFavorite}
      aria-label={isFavorite ? `Remover ${nftName} dos favoritos` : `Favoritar ${nftName}`}
      onClick={handleClick}
      className={cn('relative z-10 size-7 rounded-full', className)}
    >
      <img
        src={isFavorite ? '/icons/favorite-button-alt.svg' : '/icons/favorite-button.svg'}
        alt=""
        width={28}
        height={28}
      />
    </button>
  )
}
