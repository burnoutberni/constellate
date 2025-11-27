import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      // Use text-summary for concise terminal output, html for browser
      reporter: ['text-summary', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'client/',
        'prisma/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/tests/**',
        'src/tests/**',
        '**/*.config.*',
        '**/seed.ts',
        'scripts/**',
      ],
      reportsDirectory: './coverage',
      reportOnFailure: true,
    },
    watch: true,
    globals: true,
    environment: 'node',
    // Set environment variable to disable server logging during tests
    env: {
      VITEST: 'true',
      NODE_ENV: 'test',
    },
    // Only show failed tests, hide passing ones
    // 'basic' reporter shows minimal output and highlights failures
    // Overridden by --reporter flag in test:watch script
    reporters: process.env.CI ? ['verbose'] : ['basic'],
    // Suppress console output from tests unless it's an error
    silent: false,
  },
})

