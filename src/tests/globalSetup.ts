/**
 * Vitest global setup
 * Ensures the database is ready and migrations are applied once per run.
 */

import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import { PrismaClient } from '@prisma/client'

const MAX_ATTEMPTS = Number(process.env.TEST_DB_RETRIES || 10)
const RETRY_DELAY_MS = Number(process.env.TEST_DB_RETRY_WAIT_MS || 1000)

function redactDatabaseUrl(url: string) {
    return url.replace(/:[^:@]+@/, ':****@')
}

async function waitForDatabase(url: string) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const prisma = new PrismaClient({
            datasources: {
                db: {
                    url,
                },
            },
        })

        try {
            await prisma.$queryRawUnsafe('SELECT 1')
            await prisma.$disconnect()
            return
        } catch (error) {
            await prisma.$disconnect().catch(() => {})
            if (attempt === MAX_ATTEMPTS) {
                throw new Error(`Unable to reach database after ${MAX_ATTEMPTS} attempts: ${String(error)}`)
            }
            await sleep(RETRY_DELAY_MS)
        }
    }
}

export default async function globalSetup() {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
        throw new Error('DATABASE_URL environment variable is required for tests')
    }

    const redactedUrl = redactDatabaseUrl(databaseUrl)
    console.error(`[Vitest] Using database ${redactedUrl}`)

    await waitForDatabase(databaseUrl)

    console.error('[Vitest] Applying database migrations (prisma migrate deploy)...')
    execSync('npx prisma migrate deploy', {
        stdio: 'inherit',
        env: {
            ...process.env,
            DATABASE_URL: databaseUrl,
            NODE_ENV: 'test',
        },
    })
    mkdirSync('reports', { recursive: true })
    console.error('[Vitest] Database ready')
}
