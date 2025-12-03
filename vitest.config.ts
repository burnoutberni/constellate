import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Run setup file before all tests
    setupFiles: ['./src/tests/setup.ts'],
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
    // Set environment variables for tests
    env: {
      VITEST: 'true',
      NODE_ENV: 'test',
      // Use SQLite database for tests (relative to project root, Prisma creates it in prisma/ directory)
      DATABASE_URL: 'file:./prisma/test.db',
      // Better Auth configuration for tests
      BETTER_AUTH_URL: 'http://test.local',
      BETTER_AUTH_SECRET: 'test-secret-change-in-production',
      BETTER_AUTH_TRUSTED_ORIGINS: 'http://test.local',
    },
    // Only show failed tests, hide passing ones
    // 'basic' reporter shows minimal output and highlights failures
    // Overridden by --reporter flag in test:watch script
    reporters: process.env.CI ? ['verbose'] : ['basic'],
    // Suppress console output from tests unless it's an error
    silent: false,
  },
})

