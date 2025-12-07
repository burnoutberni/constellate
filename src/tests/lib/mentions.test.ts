import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { prisma } from '../../lib/prisma.js'
import { resolveMentions } from '../../lib/mentions.js'

beforeAll(() => {
    process.env.BETTER_AUTH_URL = process.env.BETTER_AUTH_URL || 'http://localhost:3000'
})

describe('resolveMentions', () => {
    beforeEach(async () => {
        await prisma.commentMention.deleteMany({})
        await prisma.comment.deleteMany({})
        await prisma.user.deleteMany({})
    })

    it('returns empty array when no mentions exist', async () => {
        const results = await resolveMentions('Just some text without handles')
        expect(results).toHaveLength(0)
    })

    it('detects local mentions that start a message', async () => {
        const localUser = await prisma.user.create({
            data: {
                username: 'alice',
                email: 'alice@example.com',
                name: 'Alice',
                isRemote: false,
            },
        })

        const results = await resolveMentions('@Alice thanks for organizing!')
        expect(results).toHaveLength(1)
        expect(results[0]?.user.id).toBe(localUser.id)
        expect(results[0]?.handle).toBe('@Alice')
    })

    it('ignores email-like strings but captures bracketed mentions', async () => {
        await prisma.user.create({
            data: {
                username: 'bob',
                email: 'bob@example.com',
                name: 'Bob',
                isRemote: false,
            },
        })

        const results = await resolveMentions('Reach out at bob@example.com but also say hi to (@Bob) please')
        expect(results).toHaveLength(1)
        expect(results[0]?.user.username).toBe('bob')
    })

    it('resolves remote mentions by username and domain', async () => {
        const remoteUsername = 'carol@remote.test'
        await prisma.user.create({
            data: {
                username: remoteUsername,
                name: 'Carol Remote',
                isRemote: true,
                externalActorUrl: 'https://remote.test/users/carol',
            },
        })

        const results = await resolveMentions('Excited to see you @Carol@remote.test!')
        expect(results).toHaveLength(1)
        expect(results[0]?.user.username).toBe(remoteUsername)
        expect(results[0]?.handle).toBe('@Carol@remote.test')
    })
})
