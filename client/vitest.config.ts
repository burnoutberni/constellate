import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'

const dirname =
	typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
	test: {
		globals: true,
		environment: 'jsdom',
		setupFiles: ['./src/tests/setup.ts', './src/tests/mocks.ts'],
		include: ['src/**/*.{test,spec}.{ts,tsx}'],
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
			// Storybook tests project - configured independently to avoid inheriting test.include
			{
				plugins: [
					// The plugin will run tests for the stories defined in your Storybook config
					// See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
					storybookTest({
						configDir: path.join(dirname, '.storybook'),
					}),
				],
				test: {
					name: 'storybook',
					// Note: test.include is NOT set here - Storybook uses the "stories" field in main.ts
					// This prevents the warning about ignored test.include option
					globals: true,
					environment: 'jsdom',
					css: true,
					testTimeout: 30000,
					hookTimeout: 30000,
					teardownTimeout: 30000,
					browser: {
						enabled: true,
						headless: true,
						provider: playwright({
							launch: {
								timeout: 60000,
							},
						}),
						instances: [
							{
								browser: 'chromium',
							},
						],
					},
					setupFiles: ['./.storybook/vitest.setup.ts'],
				},
			},
		],
	},
})
