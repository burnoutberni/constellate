/**
 * Prisma 7 Configuration
 * Central configuration file for Prisma ORM
 * In Prisma 7, database connection URLs are configured here instead of schema.prisma
 */

import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, env } from 'prisma/config'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
	// Path to the Prisma schema file
	schema: path.join(__dirname, 'prisma', 'schema.prisma'),

	// Migration configuration
	migrations: {
		// Path to migration files
		path: path.join(__dirname, 'prisma', 'migrations'),
		// Optional: seed script to run after migrations
		seed: 'tsx prisma/seed.ts',
	},

	// Datasource configuration
	// In Prisma 7, the database URL is configured here instead of schema.prisma
	datasource: {
		url: env('DATABASE_URL'),
	},
})
