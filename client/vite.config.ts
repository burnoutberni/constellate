/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			'better-auth/react': path.resolve(
				__dirname,
				'./node_modules/better-auth/dist/client/react/index.mjs'
			),
			// Path aliases - enforce barrel file imports
			'@/components/ui': path.resolve(__dirname, './src/components/ui/index.ts'),
			'@/components/layout': path.resolve(__dirname, './src/components/layout/index.ts'),
			'@/components/icons': path.resolve(__dirname, './src/components/icons/index.ts'),
			'@/design-system': path.resolve(__dirname, './src/design-system/index.ts'),
			'@/types': path.resolve(__dirname, './src/types/index.ts'),
			'@/hooks/queries': path.resolve(__dirname, './src/hooks/queries/index.ts'),
			'@/stores': path.resolve(__dirname, './src/stores/index.ts'),
			'@/lib': path.resolve(__dirname, './src/lib'),
			'@/components': path.resolve(__dirname, './src/components'),
			'@/hooks': path.resolve(__dirname, './src/hooks'),
			'@/pages': path.resolve(__dirname, './src/pages'),
		},
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
