/**
 * Per-worker Vitest setup
 * Applies deterministic defaults and keeps the database clean between tests.
 */

import { beforeEach } from 'vitest'
import { cleanupTestData } from './helpers/db.js'

// Force UTC to avoid locale-dependent date snapshots
process.env.TZ = 'UTC'

beforeEach(async () => {
    await cleanupTestData()
})
