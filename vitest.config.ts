import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.{test,spec}.{js,jsx,ts,tsx}'],
    exclude: ['node_modules', 'dist', '.next', 'coverage'],
    coverage: {
      provider: 'v8',
      include: ['app/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
      exclude: [
        'node_modules/',
        'dist/',
        '.next/',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/types/**',
        'test/',
      ],
      reporter: ['text', 'json', 'html'],
      statements: 50,
      branches: 50,
      functions: 50,
      lines: 50,
    },
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
