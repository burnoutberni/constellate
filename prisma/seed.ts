import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const BASE_URL = 'http://app1.local'

async function makeRequest(endpoint: string, options: RequestInit = {}) {
	const url = `${BASE_URL}${endpoint}`
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
	const setCookie = response.headers.get('set-cookie')
	let sessionCookie = ''
	if (setCookie) {
		const match = setCookie.match(/better-auth\.session_token=([^;]+)/)
		if (match) {
			sessionCookie = `better-auth.session_token=${match[1]}`
		}
	}

	return { response, sessionCookie }
}

async function authenticateUser(email: string, password: string, username: string, name: string) {
	console.log(`Authenticating user: ${email}`)

	// Try to sign up first
	try {
		const { response, sessionCookie } = await makeRequest('/api/auth/sign-up/email', {
			method: 'POST',
			body: JSON.stringify({
				email,
				password,
				username,
				name,
				tosAccepted: true,
			}),
		})

		const data = await response.json()
		console.log('Signup response:', data)

		if (sessionCookie) {
			console.log(`✅ Signed up new user: ${email}`)
			return sessionCookie
		}
	} catch (error) {
		console.log(`User ${email} might already exist, trying signin...`)
	}

	// If signup failed or no session, try signin
	try {
		const { response, sessionCookie } = await makeRequest('/api/auth/sign-in/email', {
			method: 'POST',
			body: JSON.stringify({
				email,
				password,
			}),
		})

		const data = await response.json()
		console.log('Signin response:', data)

		if (sessionCookie) {
			console.log(`✅ Signed in existing user: ${email}`)
			return sessionCookie
		}
	} catch (error) {
		console.error(`❌ Failed to authenticate user ${email}:`, error)
		throw error
	}

	throw new Error(`Could not authenticate user ${email}`)
}

async function createEvent(sessionCookie: string, eventData: any) {
	console.log(`Creating event: ${eventData.title}`)

	const { response } = await makeRequest('/api/events', {
		method: 'POST',
		body: JSON.stringify(eventData),
		headers: {
			Cookie: sessionCookie,
		},
	})

	const data = await response.json()
	console.log('Event created:', data)
	return data
}

async function createEventTemplate(sessionCookie: string, templateData: any) {
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

	const users = [
		{
			email: 'alice@example.com',
			password: 'password123!',
			username: 'alice',
			name: 'Alice Wonder',
		},
		{ email: 'bob@example.com', password: 'password123!', username: 'bob', name: 'Bob Smith' },
		{
			email: 'charlie@example.com',
			password: 'password123!',
			username: 'charlie',
			name: 'Charlie Brown',
		},
		{
			email: 'diana@example.com',
			password: 'password123!',
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
