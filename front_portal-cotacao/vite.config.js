import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const useDevApiProxy = process.env.VITE_USE_DEV_PROXY === '1'
// No Docker, o proxy roda no Node dentro do container: use o hostname do serviço (rede interna do compose).
const devProxyTarget = process.env.VITE_DEV_PROXY_TARGET || 'http://backend:8000'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    include: ['xlsx'],
  },
  server: {
    host: true,
    port: 5173,
    watch: {
      usePolling: true,
    },
    hmr: {
      clientPort: 5173,
    },
    ...(useDevApiProxy
      ? {
          proxy: {
            '/__api': {
              target: devProxyTarget,
              changeOrigin: true,
              rewrite: (p) => p.replace(/^\/__api/, '') || '/',
            },
          },
        }
      : {}),
  },
})
