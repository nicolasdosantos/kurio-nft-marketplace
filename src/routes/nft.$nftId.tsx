import { createFileRoute } from '@tanstack/react-router'
import { nftDetailQuery } from '@/api/catalog'
import { NftDetailPage } from '@/pages/NftDetailPage'

export const Route = createFileRoute('/nft/$nftId')({
  // Começa a buscar o NFT assim que a rota é reconhecida, sem esperar o componente
  // carregar. Não espera a resposta: o skeleton aparece enquanto isso.
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(nftDetailQuery(params.nftId))
  },
  component: NftDetailRoute,
})

function NftDetailRoute() {
  const { nftId } = Route.useParams()
  return <NftDetailPage key={nftId} nftId={nftId} />
}
