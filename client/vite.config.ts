/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Shared path aliases configuration - exported for use in vitest.config.ts and .storybook/main.ts
// baseDir defaults to __dirname if not provided (for CommonJS context)
export const getPathAliases = (baseDir?: string) => {
	const base = baseDir ?? (typeof __dirname !== 'undefined' ? __dirname : process.cwd())
	return {
		// Path aliases - enforce barrel file imports
		'@/components/ui': path.resolve(base, './src/components/ui/index.ts'),
		'@/components/layout': path.resolve(base, './src/components/layout/index.ts'),
		'@/components/icons': path.resolve(base, './src/components/icons/index.ts'),
		'@/design-system': path.resolve(base, './src/design-system/index.ts'),
		'@/types': path.resolve(base, './src/types/index.ts'),
		'@/hooks/queries': path.resolve(base, './src/hooks/queries/index.ts'),
		'@/stores': path.resolve(base, './src/stores/index.ts'),
		'@/lib': path.resolve(base, './src/lib'),
		'@/components': path.resolve(base, './src/components'),
		'@/hooks': path.resolve(base, './src/hooks'),
		'@/pages': path.resolve(base, './src/pages'),
		'@/contexts': path.resolve(base, './src/contexts'),
	}
}

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: getPathAliases(),
	},
	// @ts-expect-error - test property is added by vitest types via triple-slash directive
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
	},
	server: {
		host: '0.0.0.0', // Listen on all interfaces for Docker
		port: 5173,
		allowedHosts: ['app1.local', 'app2.local', 'localhost'],
		fs: {
			allow: ['..'],
		},
		proxy: {
			'/api': {
				target: 'http://localhost:3000',
				changeOrigin: true,
			},
			'/doc': {
				target: 'http://localhost:3000',
				changeOrigin: true,
			},
			'/reference': {
				target: 'http://localhost:3000',
				changeOrigin: true,
			},
			'/.well-known': {
				target: 'http://localhost:3000',
				changeOrigin: true,
			},
			'/users': {
				target: 'http://localhost:3000',
				changeOrigin: true,
			},
			'/inbox': {
				target: 'http://localhost:3000',
				changeOrigin: true,
			},
		},
	},
})
