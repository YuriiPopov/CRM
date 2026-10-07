import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    // Node 25+ определяет собственный глобальный localStorage (без --localstorage-file он
    // undefined) и перекрывает jsdom-овский — отключаем, чтобы `npx vitest run` работал без NODE_OPTIONS.
    execArgv: ['--no-experimental-webstorage'],
  },
})
