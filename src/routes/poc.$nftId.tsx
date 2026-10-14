import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { isAxiosError } from 'axios'
import {
  nftDetailQuery,
  raiseNftPriceOnServer,
  replayNftEvent,
  setRealtimeOnline,
} from '@/api/nfts'
import { Button } from '@/components/ui/button'
import { onNftEventProcessed, type NftEventLogEntry } from '@/realtime/nft-updates'
import { useSocketStatus } from '@/realtime/useSocketStatus'

export const Route = createFileRoute('/poc/$nftId')({
  component: RealtimePocPage,
})

const outcomeLabels: Record<NftEventLogEntry['outcome'], string> = {
  applied: 'aplicado',
  'ignored-stale': 'ignorado (versão antiga ou repetida)',
  'ignored-not-cached': 'ignorado (NFT fora do cache)',
}

function RealtimePocPage() {
  const { nftId } = Route.useParams()
  const nftQuery = useQuery(nftDetailQuery(nftId))
  const socketConnected = useSocketStatus()
  const [eventLog, setEventLog] = useState<NftEventLogEntry[]>([])

  useEffect(() => {
    return onNftEventProcessed((entry) => {
      if (entry.event.resourceId === nftId) {
        setEventLog((previous) => [entry, ...previous])
      }
    })
  }, [nftId])

  const raisePrice = useMutation({ mutationFn: () => raiseNftPriceOnServer(nftId) })
  const replayEvent = useMutation({
    mutationFn: (which: 'last' | 'previous') => replayNftEvent(nftId, which),
  })
  const toggleRealtime = useMutation({ mutationFn: setRealtimeOnline })

  const nftNotFound = isAxiosError(nftQuery.error) && nftQuery.error.response?.status === 404

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 p-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-heading font-bold text-text-accent">PoC REST + Socket.IO</h1>
        <Link to="/" className="text-body-sm text-text-secondary underline underline-offset-4">
          Início
        </Link>
      </div>

      <p className="text-body-sm" role="status" aria-live="polite">
        Socket:{' '}
        <strong data-testid="socket-status">
          {socketConnected ? 'conectado' : 'desconectado'}
        </strong>
      </p>

      <section className="rounded-lg border border-border bg-surface-card p-4">
        {nftQuery.isPending && <p>Carregando NFT...</p>}
        {nftNotFound && <p>NFT não encontrado.</p>}
        {nftQuery.isError && !nftNotFound && <p>Não foi possível carregar o NFT.</p>}
        {nftQuery.data && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-body-sm">
            <dt className="text-text-secondary">Nome</dt>
            <dd>{nftQuery.data.name}</dd>
            <dt className="text-text-secondary">Preço</dt>
            <dd data-testid="nft-price" className="font-bold text-text-accent">
              {nftQuery.data.priceEth} ETH
            </dd>
            <dt className="text-text-secondary">Versão</dt>
            <dd data-testid="nft-version">{nftQuery.data.version}</dd>
            <dt className="text-text-secondary">Busca REST</dt>
            <dd>{nftQuery.isFetching ? 'atualizando...' : 'em dia'}</dd>
          </dl>
        )}
      </section>

      <section className="flex flex-wrap gap-2" aria-label="Controles da simulação">
        <Button onClick={() => raisePrice.mutate()} disabled={raisePrice.isPending}>
          Aumentar preço no servidor
        </Button>
        <Button variant="outline" onClick={() => replayEvent.mutate('last')}>
          Reenviar último evento
        </Button>
        <Button variant="outline" onClick={() => replayEvent.mutate('previous')}>
          Enviar evento antigo
        </Button>
        <Button variant="destructive" onClick={() => toggleRealtime.mutate(false)}>
          Derrubar conexão
        </Button>
        <Button variant="secondary" onClick={() => toggleRealtime.mutate(true)}>
          Restaurar conexão
        </Button>
      </section>
      {replayEvent.isError && (
        <p role="alert" className="text-body-sm text-destructive">
          Ainda não há eventos suficientes para reenviar.
        </p>
      )}

      <section>
        <h2 className="mb-2 font-bold">Eventos recebidos</h2>
        {eventLog.length === 0 ? (
          <p className="text-body-sm text-text-secondary">Nenhum evento ainda.</p>
        ) : (
          <ol data-testid="event-log" className="flex flex-col gap-1 text-body-sm">
            {eventLog.map((entry, index) => (
              <li key={`${entry.event.eventId}-${index}`}>
                v{entry.event.version} · {entry.event.changes.priceEth} ETH ·{' '}
                {outcomeLabels[entry.outcome]}
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  )
}
