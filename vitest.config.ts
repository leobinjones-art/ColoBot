/// <reference types="vitest/globals" />
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    exclude: ['**/node_modules/**', '**/_legacy/**', '**/dist/**', '**/coverage/**'],
    coverage: {
      exclude: ['**/node_modules/**', '**/_legacy/**', '**/dist/**', '**/coverage/**', '**/*.d.ts'],
    },
  },
})
