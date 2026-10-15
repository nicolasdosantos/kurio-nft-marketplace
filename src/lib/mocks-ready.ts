// O worker do MSW sobe depois do primeiro render, para não disputar a rede com
// a primeira tela. A interface aparece na hora; as requisições (Axios) e o
// socket esperam por esta promessa.
let markReady: () => void = () => {}
export const mocksReady = new Promise<void>((resolve) => {
  markReady = resolve
})

let started = false

export async function startMocks() {
  if (started) return
  started = true

  if (import.meta.env.VITE_ENABLE_MOCKS === 'true') {
    const { startMockServer } = await import('@/mocks/browser')
    await startMockServer()
  }
  // Sinal para os testes: a partir daqui o fetch de dentro da página passa pelos mocks.
  document.documentElement.dataset.mocks = 'ready'
  markReady()
}
