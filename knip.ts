import type { KnipConfig } from 'knip'

/**
 * Knip configuration for the server-side codebase.
 *
 * Client-side configuration is handled separately in client/knip.ts
 */
const config: KnipConfig = {
	ignoreExportsUsedInFile: true, // Allow exports that are only used in the same file

	entry: ['src/server.ts', 'prisma/seed.ts'],
	project: ['src/**/*.ts'],

	ignore: [
		'**/*.d.ts',
		'src/tests/**/*.ts',
		// Exclude client directory - it has its own knip.ts config
		'client/**/*',
		// Exclude GitHub workflows - they use binaries that aren't part of the codebase
		'.github/**/*',
		// Public API types that may be used externally (ActivityPub types, Session type)
		'src/lib/activitypubSchemas.ts',
		'src/auth.ts',
		'src/constants/activitypub.ts',
	],

	ignoreDependencies: ['eslint-config-love'],
}

export default config
