import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api/google-maps': {
        target: 'https://maps.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/google-maps/, '/maps/api'),
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // リクエストURLからAPIキーを取得して追加
            const url = new URL(req.url, 'http://localhost')
            const apiKey = url.searchParams.get('key') || process.env.VITE_GOOGLE_MAPS_API_KEY
            if (apiKey) {
              const targetUrl = new URL(proxyReq.path, 'https://maps.googleapis.com')
              targetUrl.searchParams.set('key', apiKey)
              proxyReq.path = targetUrl.pathname + targetUrl.search
            }
          })
        },
      },
    },
  },
})

