import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'

const dirname =
	typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
	// Override Vite server config for browser tests
	server: {
		host: 'localhost', // Use localhost for browser tests (0.0.0.0 can cause WebSocket issues)
	},
	resolve: {
		alias: {
			'better-auth/react': path.resolve(
				dirname,
				'./node_modules/better-auth/dist/client/react/index.mjs'
			),
			// Path aliases - enforce barrel file imports
			'@/components/ui': path.resolve(dirname, './src/components/ui/index.ts'),
			'@/components/layout': path.resolve(dirname, './src/components/layout/index.ts'),
			'@/design-system': path.resolve(dirname, './src/design-system/index.ts'),
			'@/types': path.resolve(dirname, './src/types/index.ts'),
			'@/hooks/queries': path.resolve(dirname, './src/hooks/queries/index.ts'),
			'@/stores': path.resolve(dirname, './src/stores/index.ts'),
			'@/lib': path.resolve(dirname, './src/lib'),
			'@/components': path.resolve(dirname, './src/components'),
			'@/hooks': path.resolve(dirname, './src/hooks'),
			'@/pages': path.resolve(dirname, './src/pages'),
			'@/contexts': path.resolve(dirname, './src/contexts'),
		},
	},
	test: {
		globals: true,
		environment: 'jsdom',
		setupFiles: ['./src/tests/setup.ts', './src/tests/mocks.ts'],
		exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
		css: true,
		testTimeout: 10000,
		hookTimeout: 10000,
		teardownTimeout: 30000,
		coverage: {
			enabled: false,
			provider: 'v8',
			reporter: ['text-summary', 'json', 'json-summary', 'html'],
			exclude: [
				'node_modules/',
				'dist/',
				'**/*.test.{ts,tsx}',
				'**/*.spec.{ts,tsx}',
				'**/tests/**',
				'src/tests/**',
				'**/*.config.*',
				'vite.config.ts',
			],
			reportsDirectory: './coverage',
			reportOnFailure: true,
		},
		projects: [
			// Regular unit tests project
			{
				extends: true,
				test: {
					name: 'unit',
					include: ['src/**/*.{test,spec}.{ts,tsx}'],
				},
			},
			// Storybook tests project
			{
				extends: true, // Extend base test config - this is required by the Storybook addon
				plugins: [
					storybookTest({
						configDir: path.join(dirname, '.storybook'),
						disableAddonDocs: true,
					}),
				],
				test: {
					name: 'storybook',
					// Storybook uses the "stories" field in main.ts, not test.include
					globals: true,
					css: true,
					testTimeout: 60000,
					hookTimeout: 60000,
					setupFiles: ['./.storybook/vitest.setup.ts'],
					browser: {
						enabled: true,
						headless: true,
						provider: playwright({}),
						instances: [
							{
								browser: 'chromium',
							},
						],
					},
				},
			},
		],
	},
})
