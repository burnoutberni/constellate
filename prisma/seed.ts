import { PrismaClient } from '@prisma/client'

async function makeRequest(endpoint: string, options: RequestInit = {}) {
	const url = `${process.env.BASE_URL}${endpoint}`
	const response = await fetch(url, {
		...options,
		headers: {
			'Content-Type': 'application/json',
			...options.headers,
		},
	})

	if (!response.ok) {
		const text = await response.text()
		throw new Error(`Request failed: ${response.status} ${response.statusText} - ${text}`)
	}

	// Extract session cookie
	const cookies = response.headers.getSetCookie()
	const sessionCookie =
		cookies.find((cookie) => cookie.startsWith('better-auth.session_token=')) || ''

	return { response, sessionCookie }
}

async function authenticateUser(
	email: string,
	password: string,
	username: string,
	name: string
): Promise<string> {
	console.log(`Authenticating user: ${email}`)

	// Try signin
	try {
		const { sessionCookie } = await makeRequest('/api/auth/sign-in/email', {
			method: 'POST',
			body: JSON.stringify({
				email,
				password,
			}),
		})

		if (sessionCookie) {
			console.log(`✅ Signed in existing user: ${email}`)
			return sessionCookie
		}
	} catch (error) {
		console.log(`Sign-in for ${email} failed, attempting sign-up.`)
	}

	// Try to sign up instead
	try {
		const { sessionCookie } = await makeRequest('/api/auth/sign-up/email', {
			method: 'POST',
			body: JSON.stringify({
				email,
				password,
				username,
				name,
				tosAccepted: true,
			}),
		})

		if (sessionCookie) {
			console.log(`✅ Signed up new user: ${email}`)
			return sessionCookie
		}
	} catch (error) {
		throw new Error(`Could not sign up user ${email}: ${error}`)
	}

	throw new Error(`Authentication failed for ${email}: No session cookie received.`)
}

async function createEvent(
	sessionCookie: string,
	eventData: ReturnType<typeof generateRandomEvent>
) {
	console.log(`Creating event: ${eventData.title} (${eventData.startTime})`)

	try {
		const { response } = await makeRequest('/api/events', {
			method: 'POST',
			body: JSON.stringify(eventData),
			headers: {
				Cookie: sessionCookie,
			},
		})

		const data = await response.json()
		return data
	} catch (error) {
		console.error('Failed to create event:', error)
		throw error
	}
}

async function createEventTemplate(
	sessionCookie: string,
	templateData: {
		name: string
		description: string
		data: { title: string; summary: string; location: string; duration: string }
	}
) {
	console.log(`Creating event template: ${templateData.name}`)

	const { response } = await makeRequest('/api/event-templates', {
		method: 'POST',
		body: JSON.stringify(templateData),
		headers: {
			Cookie: sessionCookie,
		},
	})

	const data = await response.json()
	console.log('Event template created:', data)
	return data
}

function generateRandomEvent(baseDate: Date, userIndex: number) {
	const titles = [
		'Team Meeting',
		'Coffee Chat',
		'Workshop',
		'Book Club',
		'Gaming Session',
		'Art Exhibition',
		'Yoga Class',
		'Tech Talk',
		'Community Meetup',
		'Study Group',
		'Music Jam',
		'Cooking Class',
		'Photography Walk',
		'Dance Party',
		'Hackathon',
		'Meditation Session',
		'Board Game Night',
		'Karaoke Night',
		'Movie Screening',
		'Trivia Night',
	]

	const summaries = [
		'A great opportunity to connect and collaborate',
		'Join us for an engaging and informative session',
		'Come learn something new and meet interesting people',
		'A fun gathering for enthusiasts and beginners alike',
		'Share ideas and build connections in our community',
		"An exciting event you won't want to miss",
		'Perfect for networking and making new friends',
		'Explore new topics and expand your horizons',
		'A relaxing way to spend your evening',
		'Get inspired and motivated with like-minded people',
	]

	const locations = [
		'Conference Room A',
		'Local Cafe',
		'Tech Hub',
		'Library',
		'Discord',
		'Art Gallery',
		'City Park',
		'Community Center',
		'Virtual - Zoom',
		'Online',
		'Main Hall',
		'Garden',
		'Rooftop',
		'Basement',
		'Auditorium',
	]

	const timezones = [
		'Europe/Vienna',
		'America/New_York',
		'Asia/Tokyo',
		'Australia/Sydney',
		'Europe/London',
	]

	const attendanceModes = [
		'OfflineEventAttendanceMode',
		'OnlineEventAttendanceMode',
		'MixedEventAttendanceMode',
	]

	const visibilities = ['PUBLIC', 'FOLLOWERS', 'PRIVATE', 'UNLISTED']

	const eventStatuses = ['EventScheduled', 'EventScheduled', 'EventScheduled', 'EventPostponed'] // Mostly scheduled

	// Random date between 1-30 days from now
	const daysFromNow = Math.floor(Math.random() * 30) + 1
	const startDate = new Date(baseDate.getTime() + daysFromNow * 24 * 60 * 60 * 1000)

	// Random hour between 9 AM and 8 PM
	const startHour = Math.floor(Math.random() * 11) + 9
	startDate.setHours(startHour, 0, 0, 0)

	// Random duration between 30 min and 4 hours
	const durationMinutes = (Math.floor(Math.random() * 8) + 1) * 30 // 30, 60, 90, ..., 240 min
	const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000)

	// Use userIndex to make some events more likely for certain users, but still random
	const titleIndex = (userIndex * 3 + Math.floor(Math.random() * titles.length)) % titles.length
	const summaryIndex = Math.floor(Math.random() * summaries.length)
	const locationIndex = Math.floor(Math.random() * locations.length)
	const timezoneIndex = Math.floor(Math.random() * timezones.length)
	const attendanceIndex = Math.floor(Math.random() * attendanceModes.length)
	const visibilityIndex = Math.floor(Math.random() * visibilities.length)
	const statusIndex = Math.floor(Math.random() * eventStatuses.length)

	return {
		title: titles[titleIndex],
		summary: summaries[summaryIndex],
		location: locations[locationIndex],
		locationLatitude: 48.2082 + (Math.random() - 0.5) * 0.1, // Slight variation around Vienna
		locationLongitude: 16.3738 + (Math.random() - 0.5) * 0.1,
		startTime: startDate.toISOString(),
		endTime: endDate.toISOString(),
		timezone: timezones[timezoneIndex],
		eventStatus: eventStatuses[statusIndex],
		eventAttendanceMode: attendanceModes[attendanceIndex],
		visibility: visibilities[visibilityIndex],
	}
}

async function main() {
	console.log('🌱 Seeding database via APIs...')

	const prisma = new PrismaClient()

	const SEED_USER_PASSWORD = process.env.SEED_USER_PASSWORD
	if (!SEED_USER_PASSWORD) {
		console.error('❌ SEED_USER_PASSWORD environment variable is not set.')
		process.exit(1)
	}

	const users = [
		{
			email: 'alice@example.com',
			password: SEED_USER_PASSWORD,
			username: 'alice',
			name: 'Alice Wonder',
		},
		{
			email: 'bob@example.com',
			password: SEED_USER_PASSWORD,
			username: 'bob',
			name: 'Bob Smith',
		},
		{
			email: 'charlie@example.com',
			password: SEED_USER_PASSWORD,
			username: 'charlie',
			name: 'Charlie Brown',
		},
		{
			email: 'diana@example.com',
			password: SEED_USER_PASSWORD,
			username: 'diana',
			name: 'Diana Prince',
		},
	]

	try {
		const now = new Date()

		for (let i = 0; i < users.length; i++) {
			const user = users[i]
			const sessionCookie = await authenticateUser(
				user.email,
				user.password,
				user.username,
				user.name
			)

			// Create 3-5 random events for this user
			const numEvents = Math.floor(Math.random() * 3) + 3 // 3-5 events
			for (let j = 0; j < numEvents; j++) {
				const eventData = generateRandomEvent(now, i)
				await createEvent(sessionCookie, eventData)
			}

			// Create event template for Alice
			if (user.username === 'alice') {
				try {
					await createEventTemplate(sessionCookie, {
						name: 'Weekly Standup',
						description: 'Template for our weekly team sync',
						data: {
							title: 'Weekly Standup',
							summary: 'Share updates, blockers, and plans',
							location: 'Conference Room A',
							duration: 'PT30M',
						},
					})
				} catch (error) {
					console.log('Event template might already exist, skipping...')
				}

				// Make Alice an admin
				try {
					await prisma.user.update({
						where: { email: 'alice@example.com' },
						data: { isAdmin: true },
					})
					console.log('✅ Made Alice an admin')
				} catch (error) {
					console.log('Failed to make Alice admin:', error)
				}
			}
		}

		console.log('🎉 Seeding complete!')
	} catch (error) {
		console.error('❌ Seeding failed:', error)
		process.exit(1)
	} finally {
		await prisma.$disconnect()
	}
}

main()
