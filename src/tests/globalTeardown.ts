/**
 * Vitest global teardown
 * Ensures Prisma connections are closed cleanly.
 */

import { prisma } from '../lib/prisma.js'

export default async function globalTeardown() {
    await prisma.$disconnect().catch(() => {
        // Ignore disconnect errors during teardown
    })
}
