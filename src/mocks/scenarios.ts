// Cenários determinísticos (lentidão, erros, sessão expirada...) entram nas
// próximas fases. Por enquanto só existe o cenário padrão.
export type ScenarioName = 'default'

export const activeScenario: ScenarioName = 'default'
