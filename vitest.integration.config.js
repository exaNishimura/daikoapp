/// <reference types="vitest" />
/**
 * 統合テスト用 vitest 設定。
 *
 * 実 Excel ファイル (`excel-imports/`) や実 DB に依存するテストを手動で走らせる用。
 * 通常の `vitest run` (CI) では `*.integration.test.{js,jsx}` を除外している。
 *
 * 使い方: `npm run test:integration`
 */
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
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: false,
    include: ['**/*.integration.test.{js,jsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
})
