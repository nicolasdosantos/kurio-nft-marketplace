import { delay, http, HttpResponse } from 'msw'
import { errorResponse } from '../responses'
import { getScenario, latencyFor, takeRouteFault } from '../scenarios'

const PUBLIC_AUTH_ROUTES = ['/api/auth/login', '/api/auth/register']

// Roda antes de todas as rotas da API. Se não devolver nada, o MSW segue
// para o handler real; assim cenário e regra de negócio ficam separados.
export const networkConditionsHandler = http.all('/api/*', async ({ request }) => {
  const { pathname } = new URL(request.url)
  if (pathname.startsWith('/api/mock-control')) return

  const scenario = getScenario()

  const faultStatus = takeRouteFault(request.method, pathname)
  if (faultStatus) {
    await delay(150)
    return faultStatus >= 500
      ? errorResponse(faultStatus, 'INTERNAL_ERROR', 'Falha temporária no servidor.')
      : errorResponse(faultStatus, 'BAD_REQUEST', 'Falha simulada para esta rota.')
  }

  if (scenario.name === 'offline') {
    return HttpResponse.error()
  }

  if (scenario.name === 'timeout') {
    await delay('infinite')
  }

  await delay(latencyFor(request.method, pathname))

  if (scenario.name === 'server-error') {
    return request.method === 'GET'
      ? errorResponse(500, 'INTERNAL_ERROR', 'Erro interno no servidor.')
      : errorResponse(503, 'SERVICE_UNAVAILABLE', 'Serviço indisponível. Tente de novo.')
  }

  if (
    scenario.name === 'session-expired' &&
    request.headers.has('Authorization') &&
    !PUBLIC_AUTH_ROUTES.includes(pathname)
  ) {
    return errorResponse(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.')
  }
})
