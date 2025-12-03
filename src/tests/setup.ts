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
    // Ensure we use the test database URL (Prisma creates it relative to schema file)
    const testDbUrl = process.env.DATABASE_URL || 'file:./prisma/test.db'
    const testDbPath = join(process.cwd(), 'prisma', 'test.db')
    const testDbExists = existsSync(testDbPath)
    
    // Log to stderr so it shows up even if stdout is suppressed
    console.error('[Test Setup] Ensuring test database is migrated...')
    console.error(`[Test Setup] Test database URL: ${testDbUrl}`)
    console.error(`[Test Setup] Test database path: ${testDbPath}`)
    console.error(`[Test Setup] Database exists: ${testDbExists}`)
    
    try {
        // Use db push instead of migrate for tests - it's faster and doesn't require migration files
        // This will create/update the database schema to match the Prisma schema
        // --skip-generate: Don't regenerate Prisma Client (already generated)
        // --accept-data-loss: Allow schema changes that may cause data loss (OK for test DB)
        execSync('npx prisma db push --skip-generate --accept-data-loss', {
            stdio: 'inherit',
            env: {
                ...process.env,
                DATABASE_URL: testDbUrl, // Explicitly set test database URL
            },
        })
        
        console.error('[Test Setup] ✅ Test database migration completed successfully')
    } catch (error) {
        console.error('[Test Setup] ❌ Failed to migrate test database:', error)
        throw error
    }
}

