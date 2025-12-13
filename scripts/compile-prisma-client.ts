#!/usr/bin/env tsx
/**
 * Post-generation script to compile Prisma client TypeScript files to JavaScript.
 * This allows Node.js to resolve imports at runtime without needing special module resolution.
 */

import { execSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')
const generatedPrismaPath = join(projectRoot, 'src', 'generated', 'prisma')

console.log('🔨 Compiling Prisma client TypeScript files to JavaScript...')

// Create a minimal tsconfig for compiling just the generated Prisma files
// We compile to the same directory structure so Node.js can find the .js files
const generatedSrcPath = join(projectRoot, 'src', 'generated')
const tsconfigContent = {
	compilerOptions: {
		target: 'ES2022',
		module: 'ESNext',
		moduleResolution: 'bundler',
		lib: ['ES2022'],
		outDir: generatedSrcPath, // Output to src/generated
		rootDir: generatedSrcPath, // Root is src/generated
		strict: false, // Generated files may not be strict-compliant
		esModuleInterop: true,
		skipLibCheck: true,
		allowSyntheticDefaultImports: true,
		isolatedModules: true,
		noEmit: false,
		declaration: false, // We don't need .d.ts files
		sourceMap: false, // We don't need source maps for generated files
		allowJs: false,
	},
	include: [join(generatedPrismaPath, '**/*.ts')], // Include prisma/**/*.ts
	exclude: ['node_modules'],
}

// Write temporary tsconfig
const tempTsconfigPath = join(projectRoot, 'tsconfig.prisma-temp.json')
writeFileSync(tempTsconfigPath, JSON.stringify(tsconfigContent, null, 2))

try {
	// Use tsc to compile - it will preserve the directory structure
	execSync(`npx tsc --project ${tempTsconfigPath}`, {
		cwd: projectRoot,
		stdio: 'inherit',
	})

	// Post-process: Add .js extensions to relative imports in compiled files
	// Node.js ES modules require explicit file extensions
	console.log('📝 Adding .js extensions to relative imports...')
	try {
		const filesProcessed = addJsExtensionsToImports(generatedPrismaPath)
		console.log(`   Processed ${filesProcessed} file(s)`)
	} catch (error) {
		console.error('⚠️  Warning: Failed to add .js extensions:', error)
		// Don't fail the build, but warn the user
	}

	console.log('✅ Successfully compiled Prisma client TypeScript files to JavaScript')
} catch (error) {
	console.error('❌ Failed to compile Prisma client files:', error)
	process.exit(1)
} finally {
	// Clean up temporary tsconfig
	if (existsSync(tempTsconfigPath)) {
		try {
			execSync(`rm ${tempTsconfigPath}`, { cwd: projectRoot })
		} catch {
			// Ignore cleanup errors
		}
	}
}

/**
 * Recursively processes all .js files in the directory and adds .js extensions
 * to relative imports/exports that don't already have them.
 * Returns the number of files processed.
 */
function addJsExtensionsToImports(dirPath: string): number {
	const entries = readdirSync(dirPath)
	let filesProcessed = 0

	for (const entry of entries) {
		const fullPath = join(dirPath, entry)
		const stat = statSync(fullPath)

		if (stat.isDirectory()) {
			// Recursively process subdirectories
			filesProcessed += addJsExtensionsToImports(fullPath)
		} else if (entry.endsWith('.js')) {
			// Process .js files
			let content = readFileSync(fullPath, 'utf-8')
			const originalContent = content

			// Replace relative imports/exports without extensions
			// Match: from "./something" or from './something' or export * from "./something"
			// But not: from "./something.js" (already has extension) or from "@prisma/..." (external)
			// Pattern matches: (import/export statement) (quote) (relative path) (quote)
			content = content.replace(
				/((?:import|export)(?:\s+[^"']+)?\s+from\s+)(["'])(\.\/[^"']+?)(\2)/g,
				(match, statement, quote, importPath) => {
					// Skip if already has .js extension, is an index import, or has query params
					if (
						importPath.endsWith('.js') ||
						importPath.endsWith('/') ||
						importPath.includes('?') ||
						importPath.includes('#')
					) {
						return match
					}
					// Add .js extension
					return `${statement}${quote}${importPath}.js${quote}`
				}
			)

			// Only write if content changed
			if (content !== originalContent) {
				writeFileSync(fullPath, content, 'utf-8')
				filesProcessed++
			}
		}
	}

	return filesProcessed
}
