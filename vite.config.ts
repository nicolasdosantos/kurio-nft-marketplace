import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    // Precisa vir antes do plugin do React.
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      // O Início é a porta de entrada: fica no bundle principal, sem uma ida extra à rede.
      codeSplittingOptions: {
        splitBehavior: ({ routeId }) => (routeId === '/' ? [] : undefined),
      },
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
