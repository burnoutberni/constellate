import { prisma } from './prisma.js'
import { getBaseUrl } from './activitypubHelpers.js'

const mentionPattern = /@([a-zA-Z0-9_.-]+(?:@[a-zA-Z0-9.-]+)?)/g

interface MentionCandidate {
    normalized: string
    display: string
    raw: string
}

export interface MentionTarget {
    handle: string
    user: {
        id: string
        username: string
        name: string | null
        displayColor: string | null
        profileImage: string | null
        isRemote: boolean
    }
}

const userSelect = {
    id: true,
    username: true,
    name: true,
    displayColor: true,
    profileImage: true,
    isRemote: true,
} as const

function extractMentionCandidates(content: string): MentionCandidate[] {
    const matches = new Map<string, MentionCandidate>()
    if (!content) {
        return []
    }

    let match: RegExpExecArray | null
    while ((match = mentionPattern.exec(content)) !== null) {
        const raw = match[1]
        if (!raw) continue
        const startIndex = match.index ?? 0
        const prevChar = startIndex > 0 ? content[startIndex - 1] : ' '
        if (!/[\s({\[>]/.test(prevChar) && startIndex !== 0) {
            continue
        }
        const normalized = raw.toLowerCase()
        if (!matches.has(normalized)) {
            matches.set(normalized, {
                normalized,
                display: `@${raw}`,
                raw,
            })
        }
    }

    return Array.from(matches.values())
}

export async function resolveMentions(content: string): Promise<MentionTarget[]> {
    const candidates = extractMentionCandidates(content)
    if (candidates.length === 0) {
        return []
    }

    const baseUrl = getBaseUrl()
    const localDomain = new URL(baseUrl).hostname.toLowerCase()
    const results: MentionTarget[] = []

    for (const candidate of candidates) {
        const atIndex = candidate.raw.indexOf('@')
        const usernamePart = atIndex >= 0 ? candidate.raw.slice(0, atIndex) : candidate.raw
        const domainPart = atIndex >= 0 ? candidate.raw.slice(atIndex + 1) : null

        if (!usernamePart) {
            continue
        }

        let user = null

        if (domainPart && domainPart.toLowerCase() !== localDomain) {
            const usernameWithDomain = `${usernamePart.toLowerCase()}@${domainPart.toLowerCase()}`
            user = await prisma.user.findFirst({
                where: {
                    username: {
                        equals: usernameWithDomain,
                        mode: 'insensitive',
                    },
                },
                select: userSelect,
            })
        } else {
            user = await prisma.user.findFirst({
                where: {
                    username: {
                        equals: usernamePart.toLowerCase(),
                        mode: 'insensitive',
                    },
                    isRemote: false,
                },
                select: userSelect,
            })
        }

        if (user) {
            results.push({
                handle: candidate.display,
                user,
            })
        }
    }

    return results
}
