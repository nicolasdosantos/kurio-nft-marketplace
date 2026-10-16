import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useCanGoBack, useLocation, useNavigate, useRouter } from '@tanstack/react-router'
import { useAddToCart, useCartCount } from '@/api/cart'
import { useNft } from '@/api/catalog'
import type { EditionId, Nft } from '@/api/contracts/nfts'
import { ApiRequestError } from '@/api/errors'
import { useFavorites, useToggleFavorite } from '@/api/favorites'
import { queryKeys } from '@/api/query-keys'
import { Button } from '@/components/ui/button'
import { EditionPicker } from '@/components/nft/EditionPicker'
import { MobileNftHero, NftGallery } from '@/components/nft/NftGallery'
import { NftDetailSkeleton } from '@/components/nft/NftDetailSkeleton'
import { NftInfoTabs } from '@/components/nft/NftInfoTabs'
import { QuantityStepper } from '@/components/nft/QuantityStepper'
import { RelatedNfts } from '@/components/nft/RelatedNfts'
import { StarRating } from '@/components/nft/StarRating'
import { networkLabels } from '@/lib/display'
import { useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import { useSession } from '@/session/session-store'
import { useBumpKey } from '@/lib/use-bump-key'

export function NftDetailPage({ nftId }: { nftId: string }) {
  const nftQuery = useNft(nftId)
  const isTabletUp = useMediaQuery('(min-width: 768px)')

  if (nftQuery.isPending) {
    return (
      <main className={isTabletUp ? 'mx-auto w-full max-w-[1232px] px-4 pt-[41px]' : undefined}>
        <h1 className="sr-only">Carregando NFT</h1>
        <NftDetailSkeleton isTabletUp={isTabletUp} />
      </main>
    )
  }

  if (nftQuery.isError) {
    const notFound = nftQuery.error instanceof ApiRequestError && nftQuery.error.status === 404
    return (
      <main className="mx-auto flex min-h-[60dvh] w-full max-w-[1232px] flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-heading font-bold text-text-accent">
          {notFound ? 'NFT não encontrado' : 'Não foi possível carregar o NFT'}
        </h1>
        <p className="text-body-sm text-text-secondary">
          {notFound
            ? 'Ele pode ter sido removido ou o endereço está errado.'
            : nftQuery.error.message}
        </p>
        {!notFound && <Button onClick={() => nftQuery.refetch()}>Tentar de novo</Button>}
        <Link to="/" className="text-text-secondary underline underline-offset-4">
          Voltar para o início
        </Link>
      </main>
    )
  }

  return <NftDetailContent nft={nftQuery.data} isTabletUp={isTabletUp} />
}

function maxQuantityOf(nft: Nft, editionId: EditionId | null) {
  const edition = nft.editions.find((item) => item.id === editionId)
  return edition ? Math.min(edition.stock, edition.maxPerOrder) : 0
}

function NftDetailContent({ nft, isTabletUp }: { nft: Nft; isTabletUp: boolean }) {
  const session = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const router = useRouter()
  const canGoBack = useCanGoBack()
  const queryClient = useQueryClient()
  const favoritesQuery = useFavorites()
  const toggleFavorite = useToggleFavorite()
  const addToCart = useAddToCart()
  const cartCount = useCartCount()
  const cartBump = useBumpKey(cartCount)

  const [editionId, setEditionId] = useState<EditionId | null>(
    () => nft.editions.find((edition) => edition.stock > 0)?.id ?? null,
  )
  const [quantity, setQuantity] = useState(1)
  const [viewIndex, setViewIndex] = useState(0)
  const [notice, setNotice] = useState('')
  const [addedToCart, setAddedToCart] = useState(false)
  const [cartError, setCartError] = useState('')

  // Preço e estoque chegam pelo socket (nft.updated) direto no cache do detalhe.
  // Quando mudam, a seleção é ajustada aqui mesmo, durante o render, e o aviso vai
  // para a região aria-live, sem precisar de efeito.
  const [lastSeenNft, setLastSeenNft] = useState(nft)
  if (nft !== lastSeenNft) {
    setLastSeenNft(nft)
    const messages: string[] = []
    if (nft.priceEth !== lastSeenNft.priceEth) {
      messages.push(`O preço mudou para ${nft.priceEth} ETH.`)
    }
    const chosen = nft.editions.find((edition) => edition.id === editionId)
    if (chosen && chosen.stock === 0) {
      const next = nft.editions.find((edition) => edition.stock > 0)
      setEditionId(next?.id ?? null)
      setQuantity(1)
      messages.push(
        next
          ? `A edição ${chosen.label} esgotou. Selecionamos a edição ${next.label}.`
          : `A edição ${chosen.label} esgotou e não há outras disponíveis.`,
      )
    } else if (chosen) {
      const max = maxQuantityOf(nft, editionId)
      if (quantity > max) {
        setQuantity(max)
        messages.push(
          `O estoque da edição ${chosen.label} mudou. A quantidade foi ajustada para ${max}.`,
        )
      }
    }
    if (messages.length > 0) {
      setNotice(messages.join(' '))
      setAddedToCart(false)
    }
  }

  const edition = nft.editions.find((item) => item.id === editionId) ?? null
  const maxQuantity = maxQuantityOf(nft, editionId)
  const isFavorite = favoritesQuery.data?.nftIds.includes(nft.id) ?? false
  const network = networkLabels[nft.network]
  const summary = `Um colecionável digital da coleção ${nft.collection.name}, verificado na ${network}, com arte desbloqueável e acesso para colecionadores.`

  function handleEditionChange(nextEditionId: EditionId) {
    setEditionId(nextEditionId)
    setQuantity(1)
  }

  function handleFavoriteClick() {
    if (!session.user) {
      navigate({ to: '/login', search: { redirect: location.href } })
      return
    }
    toggleFavorite.mutate({ nftId: nft.id, favorite: !isFavorite })
  }

  function handleBack() {
    if (canGoBack) router.history.back()
    else navigate({ to: '/' })
  }

  function handleAddToCart() {
    if (!edition) return
    setNotice('')
    setAddedToCart(false)
    setCartError('')
    addToCart.mutate(
      { nftId: nft.id, editionId: edition.id, quantity },
      {
        onSuccess: () => {
          setNotice(`Adicionado ao carrinho: ${quantity} × ${nft.name}, edição ${edition.label}.`)
          setAddedToCart(true)
        },
        onError: (error) => {
          if (error instanceof ApiRequestError && error.code === 'OUT_OF_STOCK') {
            // O estoque na tela estava velho: busca de novo para o seletor se ajustar.
            queryClient.invalidateQueries({ queryKey: queryKeys.nftDetail(nft.id) })
            const { available } = (error.details ?? {}) as { available?: number }
            // O servidor desconta o que já está no carrinho: available é quanto ainda cabe.
            setCartError(
              available === 0
                ? `Estoque insuficiente: seu carrinho já tem todo o estoque da edição ${edition.label}.`
                : `Estoque insuficiente: só dá para adicionar mais ${available ?? 0} da edição ${edition.label}.`,
            )
            return
          }
          setCartError(
            error instanceof ApiRequestError ? error.message : 'Não foi possível adicionar.',
          )
        },
      },
    )
  }

  const favoriteLabel = isFavorite ? 'Favoritado' : 'Favoritar'
  const priceBlock = (className: string) => (
    <p data-testid="nft-price" className={cn('flex items-baseline gap-3', className)}>
      <span>{nft.priceEth} ETH</span>
      {nft.originalPriceEth && (
        <s className="text-body-md font-normal text-secondary">
          <span className="sr-only">Preço original: </span>
          {nft.originalPriceEth} ETH
        </s>
      )}
    </p>
  )
  const tokenInfo = (
    <dl className="flex flex-col gap-3 text-body leading-5 text-secondary">
      <div>
        <dt className="inline">ID do token:</dt> <dd className="inline">{nft.tokenId}</dd>
      </div>
      <div>
        <dt className="inline">Coleção:</dt>{' '}
        <dd className="inline">
          <Link
            to="/"
            search={{ collections: [nft.collection.slug] }}
            className="underline-offset-4 hover:underline"
          >
            {nft.collection.name}
          </Link>
        </dd>
      </div>
      <div>
        <dt className="inline">Atributos:</dt>{' '}
        <dd className="inline">{nft.attributes.join(', ')}</dd>
      </div>
    </dl>
  )
  const feedback = (
    <>
      <p
        role="status"
        data-testid="detail-status"
        // Vazia, a região continua na árvore de acessibilidade mas não ocupa espaço.
        className="text-body-sm text-text-accent empty:sr-only"
      >
        {notice}
        {addedToCart && notice && (
          <>
            {' '}
            <Link to="/carrinho" className="font-bold underline underline-offset-4">
              Ver carrinho
            </Link>
          </>
        )}
      </p>
      <p role="alert" className="text-body-sm text-destructive empty:sr-only">
        {cartError}
        {toggleFavorite.isError && 'Não foi possível atualizar o favorito. Tente de novo.'}
      </p>
    </>
  )

  if (!isTabletUp) {
    return (
      <main className="pb-[180px]">
        <MobileNftHero
          nft={nft}
          viewIndex={viewIndex}
          onViewChange={setViewIndex}
          onBack={handleBack}
          favoriteButton={
            <button
              type="button"
              aria-pressed={isFavorite}
              onClick={handleFavoriteClick}
              className={cn(
                'grid size-[35px] place-items-center rounded-full border bg-surface-raised',
                isFavorite ? 'border-primary' : 'border-border',
              )}
            >
              <img src="/icons/heart-small.svg" alt="" width={16} height={15} />
              <span className="sr-only">{favoriteLabel}</span>
            </button>
          }
        />

        <div className="relative -mt-[114px] flex flex-col gap-3 rounded-t-[31px] bg-surface-card px-6 pt-8 pb-6">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-[20px] leading-6 font-bold text-foreground">{nft.name}</h1>
            <p className="flex h-[27px] shrink-0 items-center gap-1 rounded-full border border-primary px-1.5 text-body-sm leading-4">
              <img src="/icons/star.svg" alt="" width={14} height={14} />
              <span className="sr-only">Nota</span>
              <span className="font-medium text-foreground">{nft.rating.average.toFixed(1)}</span>
              <span className="text-text-secondary">
                ({nft.rating.count}
                <span className="sr-only"> avaliações</span>)
              </span>
            </p>
          </div>
          <p className="text-body-sm leading-6 text-text-secondary">{summary}</p>
          <EditionPicker
            name="edicao-mobile"
            editions={nft.editions}
            selectedId={editionId}
            onSelect={handleEditionChange}
          />
          {tokenInfo}
          {feedback}
        </div>

        <div className="flex flex-col gap-24 px-6 pt-12">
          <NftInfoTabs nft={nft} />
          <RelatedNfts nft={nft} />
        </div>

        <section
          aria-label="Compra"
          className="fixed inset-x-0 bottom-0 z-40 flex flex-col gap-5 rounded-t-[40px] bg-surface-card px-6 pt-5 pb-9 shadow-[0_0_20px_rgb(10_6_4/0.45)]"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-body leading-4 font-medium text-text-secondary">Qtd.</span>
              <QuantityStepper
                size="small"
                value={quantity}
                max={maxQuantity}
                onChange={setQuantity}
              />
            </div>
            {priceBlock('text-[20px] leading-4 font-bold text-text-accent')}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={!edition || addToCart.isPending}
              onClick={handleAddToCart}
              className="h-[60px] w-[196px] rounded-full bg-[linear-gradient(135deg,var(--color-primary),rgb(210_138_76/0.8))] text-body-md leading-5 font-bold text-ink disabled:opacity-50"
            >
              {addToCart.isPending ? 'Adicionando...' : 'Comprar NFT'}
            </button>
            <Link
              to="/carrinho"
              // Aqui a tab bar some; o contador do carrinho vem para este botão.
              aria-label={`Ver carrinho, ${cartCount} ${cartCount === 1 ? 'item' : 'itens'}`}
              className="relative grid size-[60px] place-items-center rounded-full border border-border bg-surface-raised"
            >
              <img src="/icons/cart-shop.svg" alt="" width={20} height={20} />
              {cartCount > 0 && (
                <span
                  key={cartBump}
                  className={cn(
                    'absolute top-2 right-2 grid size-4 place-items-center rounded-full bg-primary text-tiny font-medium text-ink',
                    cartBump > 0 && 'animate-bump',
                  )}
                >
                  <span data-testid="cart-count">{cartCount}</span>
                </span>
              )}
            </Link>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-[1232px] flex-col gap-24 px-4 pt-[41px]">
      <div className="flex flex-col gap-3">
        <nav aria-label="Trilha de navegação" className="text-body leading-4 font-bold">
          <Link to="/" className="hover:underline">
            Início
          </Link>{' '}
          /{' '}
          <Link to="/" search={{ collections: [nft.collection.slug] }} className="hover:underline">
            {nft.collection.name}
          </Link>
        </nav>

        <div className="flex flex-col gap-8 lg:flex-row">
          <NftGallery nft={nft} viewIndex={viewIndex} onViewChange={setViewIndex} />

          <div className="flex min-w-0 flex-1 flex-col gap-5">
            <div className="flex flex-col gap-3">
              <h1 className="text-[28px] leading-[37px] font-bold text-foreground">{nft.name}</h1>
              <div className="flex flex-wrap items-center justify-between gap-3">
                {priceBlock('text-[22px] leading-4 font-bold text-text-accent')}
                <p className="flex items-center gap-1 text-body leading-5 text-foreground">
                  <StarRating average={nft.rating.average} />
                  {nft.rating.count} avaliações de colecionadores
                </p>
              </div>
              <div className="h-px bg-primary/30" />
            </div>

            <div className="flex flex-col gap-3">
              <h2 className="text-body leading-4 font-bold text-foreground">Sobre este NFT:</h2>
              <p className="text-body-sm leading-6 text-text-secondary">{summary}</p>
            </div>

            <EditionPicker
              name="edicao"
              editions={nft.editions}
              selectedId={editionId}
              onSelect={handleEditionChange}
            />

            <div className="flex flex-wrap items-start justify-between gap-4">
              <QuantityStepper
                size="large"
                value={quantity}
                max={maxQuantity}
                onChange={setQuantity}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!edition || addToCart.isPending}
                  onClick={handleAddToCart}
                  className="h-10 w-[130px] rounded-[6px] bg-primary text-body-sm leading-5 font-bold text-ink uppercase hover:bg-text-accent disabled:opacity-50"
                >
                  {addToCart.isPending ? 'Adicionando...' : 'Comprar'}
                </button>
                <button
                  type="button"
                  aria-pressed={isFavorite}
                  onClick={handleFavoriteClick}
                  className={cn(
                    'flex h-10 w-[130px] items-center justify-center gap-2 rounded-[6px] border border-primary text-body-sm leading-5 font-medium text-text-accent',
                    isFavorite && 'bg-primary/15',
                  )}
                >
                  <img src="/icons/heart-outline.svg" alt="" width={20} height={18} />
                  {favoriteLabel}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {tokenInfo}
              <div className="flex items-center gap-2">
                <h2 className="text-body leading-4 font-bold text-foreground">
                  Compartilhar este NFT:
                </h2>
                <ShareLinks nft={nft} />
              </div>
            </div>
            {feedback}
          </div>
        </div>
      </div>

      <NftInfoTabs nft={nft} />
      <RelatedNfts nft={nft} />
    </main>
  )
}

function ShareLinks({ nft }: { nft: Nft }) {
  const url = encodeURIComponent(window.location.href)
  const text = encodeURIComponent(`${nft.name} na Kurio`)
  const links = [
    {
      label: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      icon: '/icons/share-linkedin.svg',
      width: 15,
      height: 15,
    },
    {
      label: 'e-mail',
      href: `mailto:?subject=${text}&body=${url}`,
      icon: '/icons/share-mail.svg',
      width: 18,
      height: 18,
    },
    {
      label: 'X (Twitter)',
      href: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      icon: '/icons/share-twitter.svg',
      width: 16,
      height: 13,
    },
  ]

  return (
    <ul className="flex items-center gap-2">
      {links.map((link) => (
        <li key={link.label} className="flex">
          <a
            href={link.href}
            target={link.href.startsWith('mailto:') ? undefined : '_blank'}
            rel="noopener noreferrer"
            aria-label={`Compartilhar por ${link.label}`}
            className="grid size-[18px] place-items-center"
          >
            <img src={link.icon} alt="" width={link.width} height={link.height} />
          </a>
        </li>
      ))}
    </ul>
  )
}
