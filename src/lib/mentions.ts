import { prisma } from './prisma.js'
import { getBaseUrl } from './activitypubHelpers.js'

const mentionPattern = /@([a-zA-Z0-9_.-]+(?:@[a-zA-Z0-9.-]+)?)/g
const boundaryCharacters = new Set(['(', '{', '[', '>'])

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
		if (startIndex !== 0 && !/\s/.test(prevChar) && !boundaryCharacters.has(prevChar)) {
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

function splitCandidatesByDomain(candidates: MentionCandidate[], localDomain: string) {
	const localCandidates: Array<{ candidate: MentionCandidate; username: string }> = []
	const remoteCandidates: Array<{ candidate: MentionCandidate; usernameWithDomain: string }> = []

	for (const candidate of candidates) {
		const atIndex = candidate.raw.indexOf('@')
		const usernamePart = atIndex >= 0 ? candidate.raw.slice(0, atIndex) : candidate.raw
		const domainPart = atIndex >= 0 ? candidate.raw.slice(atIndex + 1) : null

		if (!usernamePart) continue

		if (domainPart && domainPart.toLowerCase() !== localDomain) {
			remoteCandidates.push({
				candidate,
				usernameWithDomain: `${usernamePart.toLowerCase()}@${domainPart.toLowerCase()}`,
			})
		} else {
			localCandidates.push({
				candidate,
				username: usernamePart.toLowerCase(),
			})
		}
	}

	return { localCandidates, remoteCandidates }
}

async function fetchLocalUsers(localUsernames: string[]): Promise<MentionTarget['user'][]> {
	if (localUsernames.length === 0) return []

	const users = await prisma.user.findMany({
		where: {
			AND: [
				{
					OR: localUsernames.map((username) => ({
						username: {
							equals: username,
							mode: 'insensitive',
						},
					})),
				},
				{
					isRemote: false,
				},
			],
		},
		select: userSelect,
	})
	return users || []
}

async function fetchRemoteUsers(remoteUsernames: string[]): Promise<MentionTarget['user'][]> {
	if (remoteUsernames.length === 0) return []

	const users = await prisma.user.findMany({
		where: {
			OR: remoteUsernames.map((username) => ({
				username: {
					equals: username,
					mode: 'insensitive',
				},
			})),
		},
		select: userSelect,
	})
	return users || []
}

function buildUserMaps(
	localUsers: MentionTarget['user'][] | undefined,
	remoteUsers: MentionTarget['user'][] | undefined
) {
	const localUserMap = new Map(
		(localUsers || []).map((user) => [user.username.toLowerCase(), user])
	)
	const remoteUserMap = new Map(
		(remoteUsers || []).map((user) => [user.username.toLowerCase(), user])
	)
	return { localUserMap, remoteUserMap }
}

function buildResults(
	localCandidates: Array<{ candidate: MentionCandidate; username: string }>,
	remoteCandidates: Array<{ candidate: MentionCandidate; usernameWithDomain: string }>,
	userMaps: {
		localUserMap: Map<string, MentionTarget['user']>
		remoteUserMap: Map<string, MentionTarget['user']>
	}
) {
	const results: MentionTarget[] = []

	for (const { candidate, username } of localCandidates) {
		const user = userMaps.localUserMap.get(username)
		if (user) {
			results.push({ handle: candidate.display, user })
		}
	}

	for (const { candidate, usernameWithDomain } of remoteCandidates) {
		const user = userMaps.remoteUserMap.get(usernameWithDomain.toLowerCase())
		if (user) {
			results.push({ handle: candidate.display, user })
		}
	}

	return results
}

export async function resolveMentions(content: string): Promise<MentionTarget[]> {
	const candidates = extractMentionCandidates(content)
	if (candidates.length === 0) return []

	const baseUrl = getBaseUrl()
	const localDomain = new URL(baseUrl).hostname.toLowerCase()

	const { localCandidates, remoteCandidates } = splitCandidatesByDomain(candidates, localDomain)

	const [localUsers, remoteUsers] = await Promise.all([
		fetchLocalUsers(localCandidates.map((c) => c.username)),
		fetchRemoteUsers(remoteCandidates.map((c) => c.usernameWithDomain)),
	])

	const userMaps = buildUserMaps(localUsers, remoteUsers)
	return buildResults(localCandidates, remoteCandidates, userMaps)
}
