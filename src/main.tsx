import '@fontsource/roboto-mono/400.css'
import '@fontsource/roboto-mono/500.css'
import '@fontsource/roboto-mono/700.css'
import './index.css'

async function startMocks() {
  if (import.meta.env.VITE_ENABLE_MOCKS !== 'true') return

  const { startMockServer } = await import('./mocks/browser')
  await startMockServer()
}

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root not found')

// O app é importado só depois do worker pronto: o engine.io-client guarda o
// `WebSocket` global ao carregar o módulo, e precisa pegar a versão já
// interceptada pelo MSW. Também evita requisições escapando dos mocks.
startMocks().then(async () => {
  const { renderApp } = await import('./app')
  renderApp(rootElement)
})
