import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  changeMockScenario,
  disconnectMockWallets,
  expireMockSessions,
  fetchMockScenario,
  resetMockServer,
} from '@/api/mock-control'
import { Button } from '@/components/ui/button'

// Painel só para demonstração: troca o cenário dos mocks sem mexer no código.
export function MockPanel({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()

  const scenarioQuery = useQuery({
    queryKey: ['mock-control', 'scenario'],
    queryFn: fetchMockScenario,
  })

  // Depois de mudar o "servidor", tudo que está em cache pode estar velho.
  const refreshEverything = () => queryClient.invalidateQueries()

  const changeScenario = useMutation({
    mutationFn: changeMockScenario,
    onSuccess: refreshEverything,
  })
  const reset = useMutation({ mutationFn: resetMockServer, onSuccess: refreshEverything })
  const expireSessions = useMutation({
    mutationFn: expireMockSessions,
    onSuccess: refreshEverything,
  })
  const disconnectWallets = useMutation({ mutationFn: disconnectMockWallets })

  return (
    <aside
      aria-label="Painel de simulação"
      className="fixed right-4 bottom-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-border-soft bg-surface-card p-4 text-body-sm shadow-lg"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold text-text-accent">Simulação</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-text-secondary underline underline-offset-4"
        >
          Fechar
        </button>
      </div>

      <label htmlFor="mock-scenario" className="mb-1 block text-text-secondary">
        Cenário
      </label>
      <select
        id="mock-scenario"
        className="mb-1 w-full rounded-md border border-input bg-ink p-2"
        value={scenarioQuery.data?.name ?? 'default'}
        onChange={(event) => changeScenario.mutate(event.target.value)}
        disabled={!scenarioQuery.data}
      >
        {Object.entries(scenarioQuery.data?.available ?? {}).map(([name, description]) => (
          <option key={name} value={name}>
            {name}: {description}
          </option>
        ))}
      </select>
      <p className="mb-3 text-caption-sm text-text-secondary">
        O cenário fica salvo até trocar ou resetar.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="destructive" onClick={() => reset.mutate()}>
          Resetar dados
        </Button>
        <Button size="sm" variant="outline" onClick={() => expireSessions.mutate()}>
          Expirar sessões
        </Button>
        <Button size="sm" variant="outline" onClick={() => disconnectWallets.mutate()}>
          Desconectar carteiras
        </Button>
      </div>

      <p role="status" className="mt-3 text-caption-sm text-text-secondary">
        {reset.isSuccess && 'Dados restaurados para o cenário inicial.'}
      </p>
    </aside>
  )
}
