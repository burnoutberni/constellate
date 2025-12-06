import { beforeEach, afterAll, vi } from 'vitest'
import { createPrismock } from '@pkgverse/prismock'
import { PrismaClient } from '@prisma/client'

const prismaPromise = createPrismock(PrismaClient)

vi.mock('../lib/prisma.js', async () => {
    const prisma = await prismaPromise
    return { prisma }
})

process.env.TZ = 'UTC'
process.env.NODE_ENV = 'test'
process.env.VITEST = 'true'
process.env.DATABASE_URL ??= 'file:./tests/dev.db'

beforeEach(async () => {
    const prisma = await prismaPromise
    prisma.reset()
})

afterAll(async () => {
    const prisma = await prismaPromise
    await prisma.$disconnect()
})

export async function getPrismaMock() {
    return prismaPromise
}
