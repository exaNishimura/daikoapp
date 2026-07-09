/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.js',
      css: false,
      // *.integration.test.{js,jsx} は実 Excel ファイルや実 DB 依存のため
      // 通常の `vitest run` (CI) では除外。手動実行は `npm run test:integration`。
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.{idea,git,cache,output,temp}/**',
        '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
        '**/*.integration.test.{js,jsx}',
      ],
    },
    server: {
      proxy: {
        '/api/google-maps': {
          target: 'https://maps.googleapis.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/google-maps/, '/maps/api'),
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, _req, _res) => {
              const apiKey = env.VITE_GOOGLE_MAPS_API_KEY
              if (!apiKey) return

              const targetUrl = new URL(proxyReq.path, 'https://maps.googleapis.com')
              targetUrl.searchParams.set('key', apiKey)
              proxyReq.path = targetUrl.pathname + targetUrl.search
            })
          },
        },
      },
    },
  }
})
