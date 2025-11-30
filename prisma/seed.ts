import { PrismaClient } from '@prisma/client'
import { generateKeyPairSync } from 'crypto'

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Seeding database...')

    // Generate RSA key pair for test user
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem',
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem',
        },
    })

    // Create a test local user
    const testUser = await prisma.user.upsert({
        where: { username: 'alice' },
        update: {
            isAdmin: true, // Make alice admin on update too
        },
        create: {
            username: 'alice',
            email: 'alice@localhost',
            name: 'Alice Wonder',
            displayColor: '#8b5cf6',
            bio: 'Test user for Stellar Calendar',
            publicKey,
            privateKey,
            isRemote: false,
            isAdmin: true, // Make alice admin by default
        },
    })

    console.log('✅ Created test user:', testUser.username)

    // Create some sample events
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const nextWeek = new Date(now)
    nextWeek.setDate(nextWeek.getDate() + 7)

    const event1 = await prisma.event.create({
        data: {
            title: 'Team Meeting',
            summary: 'Weekly team sync to discuss project progress',
            location: 'Conference Room A',
            startTime: tomorrow,
            endTime: new Date(tomorrow.getTime() + 60 * 60 * 1000), // 1 hour later
            userId: testUser.id,
            attributedTo: `http://localhost:3000/users/${testUser.username}`,
            eventStatus: 'EventScheduled',
            eventAttendanceMode: 'OfflineEventAttendanceMode',
        },
    })

    const event2 = await prisma.event.create({
        data: {
            title: 'Community Meetup',
            summary: 'Monthly community gathering for ActivityPub enthusiasts',
            location: 'Virtual - Zoom',
            startTime: nextWeek,
            endTime: new Date(nextWeek.getTime() + 2 * 60 * 60 * 1000), // 2 hours later
            userId: testUser.id,
            attributedTo: `http://localhost:3000/users/${testUser.username}`,
            eventStatus: 'EventScheduled',
            eventAttendanceMode: 'OnlineEventAttendanceMode',
        },
    })

    console.log('✅ Created sample events:', event1.title, event2.title)

    console.log('🎉 Seeding complete!')
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
