/// <reference types="vitest/globals" />
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    exclude: ['**/node_modules/**', '**/_legacy/**', '**/dist/**', '**/coverage/**'],
    coverage: {
      provider: 'v8',
      include: [
        'packages/*/dist/**/*.js',
      ],
      exclude: [
        '**/node_modules/**',
        '**/_legacy/**',
        '**/coverage/**',
        '**/*.d.ts',
        '**/__tests__/**',
        '**/*.test.ts',
      ],
    },
  },
})
