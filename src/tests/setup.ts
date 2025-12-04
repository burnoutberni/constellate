/**
 * Test Setup File
 * Runs before all tests to ensure the test database is properly migrated
 */

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

/**
 * Ensure test database is migrated before running tests
 */
export default async function setup() {
    // Ensure we use the test database URL
    // In CI, DATABASE_URL should be set to a PostgreSQL connection string
    // Locally, it can be SQLite (file:./prisma/test.db) or PostgreSQL
    const testDbUrl = process.env.DATABASE_URL
    if (!testDbUrl) {
        throw new Error('DATABASE_URL environment variable is required for tests')
    }

    // Log to stderr so it shows up even if stdout is suppressed
    console.error('[Test Setup] Ensuring test database is migrated...')
    console.error(`[Test Setup] Test database URL: ${testDbUrl.replace(/:[^:@]+@/, ':****@')}`) // Hide password in logs

    try {
        // Always use migrations (works for both PostgreSQL and SQLite)
        console.error('[Test Setup] Running database migrations...')
        execSync('npx prisma migrate deploy', {
            stdio: 'inherit',
            env: {
                ...process.env,
                DATABASE_URL: testDbUrl,
            },
        })

        console.error('[Test Setup] ✅ Test database migration completed successfully')
    } catch (error) {
        console.error('[Test Setup] ❌ Failed to migrate test database:', error)
        throw error
    }
}

