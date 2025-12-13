import { defineConfig } from 'vitest/config'
import { resolve, dirname } from 'path'
import { existsSync } from 'fs'
import type { Plugin } from 'vite'

const junitReporter: ['junit', { outputFile: string }] = [
	'junit',
	{
		outputFile: 'reports/junit.xml',
	},
]

// Plugin to handle TypeScript imports in generated Prisma client
// This resolves relative imports like "./enums" to "./enums.ts"
const prismaClientResolver: Plugin = {
	name: 'prisma-client-resolver',
	enforce: 'pre',
	resolveId(id, importer) {
		// Only handle relative imports from generated prisma directory
		if (!importer || !id.startsWith('.')) {
			return null
		}

		if (importer.includes('src/generated/prisma')) {
			// Resolve the relative import
			const importerDir = dirname(importer)
			const resolvedPath = resolve(importerDir, id)

			// Check if .ts file exists
			if (existsSync(`${resolvedPath}.ts`)) {
				return `${resolvedPath}.ts`
			}

			// Check if it's a directory with index.ts
			if (existsSync(resolvedPath) && existsSync(resolve(resolvedPath, 'index.ts'))) {
				return resolve(resolvedPath, 'index.ts')
			}
		}

		return null
	},
}

export default defineConfig({
	plugins: [prismaClientResolver],
	resolve: {
		alias: {
			// Workaround for prismock compatibility with Prisma 7
			// Prismock expects @prisma/client/runtime/library but Prisma 7 uses @prisma/client/runtime/client
			'@prisma/client/runtime/library': '@prisma/client/runtime/client',
			// Redirect .prisma/client to our custom generated location
			// This helps with module resolution when @prisma/client tries to require .prisma/client/default
			'.prisma/client': resolve(process.cwd(), 'src/generated/prisma'),
		},
		// Ensure TypeScript extensions are resolved for generated prisma files
		extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
	},
	server: {
		fs: {
			// Allow access to the generated prisma directory
			allow: [process.cwd(), resolve(process.cwd(), 'src/generated')],
		},
	},
	test: {
		setupFiles: ['./src/tests/setupVitest.ts'],
		exclude: ['node_modules/**', 'dist/**', 'client/**', 'prisma/**', 'scripts/**'],
		coverage: {
			provider: 'v8',
			reporter: ['text-summary', 'json', 'json-summary', 'html'],
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
		pool: 'forks',
		poolOptions: {
			forks: {
				singleFork: true,
			},
		},
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
			ENCRYPTION_KEY:
				process.env.ENCRYPTION_KEY ||
				'0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
		},
		reporters: process.env.CI ? ['default', junitReporter] : ['default'],
		silent: Boolean(process.env.CI),
	},
})
