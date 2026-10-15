import type { Network } from '@/api/contracts/common'
import type { Nft } from '@/api/contracts/nfts'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { networkLabels } from '@/lib/display'
import { StarRating } from './StarRating'

const contractStandards: Record<Network, string> = {
  ethereum: 'ERC-721',
  polygon: 'ERC-721',
  solana: 'Metaplex',
}

const triggerClasses =
  'h-auto flex-none rounded-none border-0 p-0 pb-3 text-[17px] leading-4 font-normal text-foreground data-active:font-bold data-active:text-text-accent group-data-horizontal/tabs:after:bottom-0 group-data-horizontal/tabs:after:h-[3px] after:bg-primary'

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' })

export function NftInfoTabs({ nft }: { nft: Nft }) {
  const network = networkLabels[nft.network]

  return (
    <Tabs defaultValue="detalhes" className="gap-3">
      <TabsList
        variant="line"
        aria-label="Informações do NFT"
        // Linha fina de fundo do Figma; a aba ativa desenha a sua por cima.
        className="relative h-auto w-full justify-start gap-8 overflow-x-auto rounded-none p-0 after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-primary/30"
      >
        <TabsTrigger value="detalhes" className={triggerClasses}>
          Detalhes do NFT
        </TabsTrigger>
        <TabsTrigger value="avaliacoes" className={triggerClasses}>
          Avaliações de colecionadores ({nft.rating.count})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="detalhes" className="text-body-sm leading-6 text-text-secondary">
        <p>{nft.description}</p>
        <dl className="mt-3 flex flex-col gap-3">
          <div>
            <dt className="font-bold text-foreground">Rede:</dt>
            <dd>Cunhado na {network} com procedência imutável e metadados armazenados no IPFS.</dd>
          </div>
          <div>
            <dt className="font-bold text-foreground">Contrato:</dt>
            <dd>
              <span title={nft.contractAddress}>{shortAddress(nft.contractAddress)}</span> •
              Contrato inteligente {contractStandards[nft.network]} verificado.
            </dd>
          </div>
          <div>
            <dt className="font-bold text-foreground">Direitos autorais:</dt>
            <dd>
              Direitos autorais do criador: {nft.royaltyPercent}% nas vendas secundárias, pagos
              automaticamente pelos mercados compatíveis.
            </dd>
          </div>
        </dl>
      </TabsContent>

      <TabsContent value="avaliacoes" className="text-body-sm leading-6 text-text-secondary">
        <p>
          Nota média {nft.rating.average.toFixed(1).replace('.', ',')} de 5 em {nft.rating.count}{' '}
          avaliações. Estas são as mais recentes:
        </p>
        <ul className="mt-3 flex flex-col gap-4">
          {nft.reviews.map((review) => (
            <li key={`${review.author}-${review.createdAt}`} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-bold text-foreground">{review.author}</span>
                <StarRating average={review.rating} />
                <time dateTime={review.createdAt} className="text-caption">
                  {dateFormat.format(new Date(review.createdAt))}
                </time>
              </div>
              <p>{review.comment}</p>
            </li>
          ))}
        </ul>
      </TabsContent>
    </Tabs>
  )
}
