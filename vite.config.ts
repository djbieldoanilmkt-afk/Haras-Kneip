/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    /*
      O trabalhador de vídeo roda em Node puro, com `node --test`, e o Vitest
      não consegue empacotar `node:test`. Ele tem o próprio comando:
      `npm test` dentro de `worker/`.
    */
    exclude: ['**/node_modules/**', '**/dist/**', 'worker/**'],
  },
})
