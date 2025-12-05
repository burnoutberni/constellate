import { defineConfig } from 'vitest/config'

const junitReporter: ['junit', { outputFile: string }] = [
  'junit',
  {
    outputFile: 'reports/junit.xml',
  },
]

export default defineConfig({
  test: {
    setupFiles: ['./src/tests/setupVitest.ts'],
    coverage: {
      provider: 'v8',
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
    threads: false,
    globals: true,
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      VITEST: 'true',
      NODE_ENV: 'test',
      BETTER_AUTH_URL: 'http://test.local',
      BETTER_AUTH_SECRET: 'test-secret-change-in-production',
      BETTER_AUTH_TRUSTED_ORIGINS: 'http://test.local',
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    },
    reporters: process.env.CI ? ['default', junitReporter] : ['default'],
    silent: Boolean(process.env.CI),
  },
})

