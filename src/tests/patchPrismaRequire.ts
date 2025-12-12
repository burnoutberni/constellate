/**
 * Prisma Client Require Patch
 * 
 * Patches Node's require to redirect @prisma/client imports for prismock compatibility.
 * This is necessary when using Prisma 7 with a custom client output path.
 * 
 * Prisma 7 allows generating the client to a custom path (src/generated/prisma),
 * but prismock and @prisma/client internally try to require .prisma/client paths
 * which don't exist with a custom output. This patch redirects those requires.
 * 
 * Note: Since the generated client is TypeScript, we use Module._resolveFilename
 * to let the module resolution system (vitest/tsx) handle the TypeScript transpilation.
 */

import Module from 'module'
import { join, dirname } from 'path'
import { existsSync } from 'fs'

const originalRequire = Module.prototype.require
const GENERATED_PRISMA_CLIENT_PATH = join(process.cwd(), 'src/generated/prisma')

// Helper to check if a path is within our generated prisma directory
function isInGeneratedPrisma(path: string): boolean {
	return path.startsWith(GENERATED_PRISMA_CLIENT_PATH)
}

// Patch Module._resolveFilename to redirect .prisma/client paths
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const originalResolveFilename = (Module as any)._resolveFilename
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(Module as any)._resolveFilename = function (request: string, parent: Module, isMain: boolean, options?: any) {
	// If the parent is from our generated prisma directory and it's a relative import,
	// ensure it resolves correctly (vitest/tsx should handle .ts extension)
	if (parent && parent.filename && isInGeneratedPrisma(parent.filename)) {
		// For relative imports from generated prisma files, let vitest handle it
		// but ensure the path is correct
		if (request.startsWith('.')) {
			try {
				return originalResolveFilename.call(this, request, parent, isMain, options)
			} catch {
				// If that fails, try with .ts extension
				const parentDir = dirname(parent.filename)
				const resolvedPath = join(parentDir, request)
				if (existsSync(`${resolvedPath}.ts`)) {
					try {
						return originalResolveFilename.call(this, `${resolvedPath}.ts`, parent, isMain, options)
					} catch {
						// Fall through
					}
				}
			}
		}
	}
	
	// Redirect .prisma/client paths to our custom generated location
	if (request.startsWith('.prisma/client')) {
		// Map .prisma/client/default to src/generated/prisma/client
		if (request === '.prisma/client/default' || request === '.prisma/client') {
			const customPath = join(GENERATED_PRISMA_CLIENT_PATH, 'client')
			// Let the module resolution system handle the path (vitest/tsx will transpile TypeScript)
			try {
				return originalResolveFilename.call(this, customPath, parent, isMain, options)
			} catch {
				// If that fails, try with .ts extension
				try {
					return originalResolveFilename.call(this, `${customPath}.ts`, parent, isMain, options)
				} catch {
					// Fall through to original resolution
				}
			}
		}
		
		// For other .prisma/client paths, try to map them
		const relativePath = request.replace('.prisma/client', '')
		const customPath = join(GENERATED_PRISMA_CLIENT_PATH, relativePath)
		try {
			return originalResolveFilename.call(this, customPath, parent, isMain, options)
		} catch {
			try {
				return originalResolveFilename.call(this, `${customPath}.ts`, parent, isMain, options)
			} catch {
				// Fall through to original resolution
			}
		}
	}
	
	// For all other requests, use the original resolution
	return originalResolveFilename.call(this, request, parent, isMain, options)
}

Module.prototype.require = function (id: string) {
	// Redirect @prisma/client/runtime/library to runtime/client (Prisma 7 compatibility)
	// Prismock expects the old path, but Prisma 7 uses the new path
	if (id === '@prisma/client/runtime/library') {
		return originalRequire.call(this, '@prisma/client/runtime/client')
	}
	
	// For all other requires, use the original behavior
	// The _resolveFilename patch above will handle .prisma/client paths
	return originalRequire.apply(this, arguments as any)
}

