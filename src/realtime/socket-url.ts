// Fica num arquivo separado e sem imports porque os mocks também usam:
// eles não podem carregar o socket.io-client antes do MSW iniciar.
export const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin
