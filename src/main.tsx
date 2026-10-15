import '@fontsource/roboto-mono/400.css'
import '@fontsource/roboto-mono/500.css'
import '@fontsource/roboto-mono/700.css'
import './index.css'
import { renderApp } from './app'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root not found')

// Não espera o MSW nem a sessão: o layout e os skeletons aparecem na hora.
// O MSW sobe logo depois do primeiro render (ver app.tsx) e o socket.io-client
// só é carregado com o worker pronto (ver useRealtimeSync).
renderApp(rootElement)
