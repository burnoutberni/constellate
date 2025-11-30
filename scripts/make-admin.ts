/**
 * Script to make a user an admin
 * Usage: tsx scripts/make-admin.ts <username>
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const username = process.argv[2]

    if (!username) {
        console.error('Usage: tsx scripts/make-admin.ts <username>')
        process.exit(1)
    }

    const user = await prisma.user.findUnique({
        where: { username },
    })

    if (!user) {
        console.error(`User "${username}" not found`)
        process.exit(1)
    }

    if (user.isAdmin) {
        console.log(`User "${username}" is already an admin`)
        process.exit(0)
    }

    await prisma.user.update({
        where: { username },
        data: { isAdmin: true },
    })

    console.log(`✅ Successfully made "${username}" an admin`)
}

main()
    .catch((e) => {
        console.error('Error:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })

