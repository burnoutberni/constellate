import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { z } from 'zod'

import { EventCard } from '@/components/EventCard'
import { OnboardingHero } from '@/components/Feed/OnboardingHero'
import { Sidebar } from '@/components/Feed/Sidebar'
import { SuggestedUsersCard } from '@/components/Feed/SuggestedUsersCard'
import { Navbar } from '@/components/Navbar'
import { Button, Card, Spinner, AddIcon } from '@/components/ui'
import { useHomeFeed, type FeedItem } from '@/hooks/queries'
import { useAuth } from '@/hooks/useAuth'
import { useUIStore } from '@/stores'
// import { Activity, SuggestedUser, Event } from '@/types'

// Type guards

// Validated data types
type ValidatedSuggestedUsers = z.infer<typeof SuggestedUsersSchema>
type ValidatedEvent = z.infer<typeof EventSchema>
type ValidatedActivity = z.infer<typeof ActivitySchema>
type ValidatedHeader = z.infer<typeof HeaderSchema>

// Schemas
// Schemas
const EventUserSchema = z.object({
	id: z.string(),
	username: z.string(),
	name: z.string().nullable().optional(),
	displayColor: z.string().optional(),
	profileImage: z.string().nullable().optional(),
	isRemote: z.boolean(),
})

const TagSchema = z.object({
	id: z.string(),
	tag: z.string(),
})

const EventSchema = z.object({
	id: z.string(),
	title: z.string(),
	startTime: z.string(),
	endTime: z.string().nullable().optional(),
	timezone: z.string().default('UTC'),
	summary: z.string().nullable().optional(),
	location: z.string().nullable().optional(),
	headerImage: z.string().nullable().optional(),
	user: EventUserSchema.optional(),
	userId: z.string().optional(),
	visibility: z.enum(['PUBLIC', 'FOLLOWERS', 'PRIVATE', 'UNLISTED']).optional(),
	tags: z.array(TagSchema).default([]),
	_count: z.object({
		attendance: z.number(),
		likes: z.number(),
		comments: z.number(),
	}).optional(),
	attendance: z.array(z.object({
		status: z.string(),
		user: EventUserSchema,
	})).optional(),
	viewerStatus: z.enum(['attending', 'maybe', 'not_attending']).nullable().optional(),
}).passthrough() // Allow extra fields but ensure core ones are present

const ActivitySchema = z.object({
	id: z.string(),
	type: z.string(),
	createdAt: z.string(),
	user: EventUserSchema,
	event: EventSchema,
})

const SuggestedUserSchema = z.object({
	id: z.string(),
	username: z.string(),
	name: z.string().nullable(),
	displayColor: z.string(),
	profileImage: z.string().nullable(),
	bio: z.string().nullable().optional(),
	_count: z.object({
		followers: z.number(),
		events: z.number()
	}).optional()
})

const SuggestedUsersSchema = z.object({
	suggestions: z.array(SuggestedUserSchema)
})

const HeaderSchema = z.object({
	title: z.string(),
})


// Validation helpers
function getSuggestedUsersData(data: unknown): ValidatedSuggestedUsers | null {
	const result = SuggestedUsersSchema.safeParse(data)
	if (!result.success) { return null }
	return result.data
}

function getTrendingEventData(data: unknown): ValidatedEvent | null {
	const result = EventSchema.safeParse(data)
	return result.success ? result.data : null
}

function getActivityData(data: unknown): ValidatedActivity | null {
	const result = ActivitySchema.safeParse(data)
	return result.success ? result.data : null
}

function getHeaderData(data: unknown): ValidatedHeader | null {
	const result = HeaderSchema.safeParse(data)
	return result.success ? result.data : null
}

export function FeedPage() {
	const { user, logout } = useAuth()
	const { sseConnected, isFeedRefreshing } = useUIStore()

	// Unified Feed Query (Smart Agenda)
	const {
		data,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		isFetching,
		refetch,
		status,
		error
	} = useHomeFeed()

	// Infinite Scroll Intersection Observer
	const loadMoreRef = useRef<HTMLDivElement>(null)

	const isRefetching = (isFetching && !isFetchingNextPage) || isFeedRefreshing

	useEffect(() => {
		if (!hasNextPage || isFetchingNextPage) { return }

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) {
					fetchNextPage()
				}
			},
			{ threshold: 0.5 }
		)

		if (loadMoreRef.current) {
			observer.observe(loadMoreRef.current)
		}

		return () => observer.disconnect()
	}, [hasNextPage, isFetchingNextPage, fetchNextPage])


	if (status === 'pending') {
		return (
			<div className="min-h-screen bg-background-secondary">
				<Navbar isConnected={sseConnected} user={user} onLogout={logout} />
				<div className="max-w-6xl mx-auto py-8 px-4 flex gap-6">
					<div className="flex-1">
						<Card variant="default" padding="lg" className="text-center">
							<Spinner size="md" />
						</Card>
					</div>
					<Sidebar />
				</div>
			</div>
		)
	}

	if (status === 'error') {
		const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
		return (
			<div className="min-h-screen bg-background-secondary">
				<Navbar isConnected={sseConnected} user={user} onLogout={logout} />
				<div className="max-w-6xl mx-auto py-8 px-4 flex gap-6">
					<div className="flex-1">
						<Card variant="default" padding="lg" className="text-center text-error-600">
							<p>Failed to load feed.</p>
							<p className="text-sm mt-2">{errorMessage}</p>
							<Button variant="primary" size="sm" className="mt-4" onClick={() => refetch()}>
								Retry
							</Button>
						</Card>
					</div>
					<Sidebar />
				</div>
			</div>
		)
	}

	const allItems = data?.pages?.flatMap((page: { items: FeedItem[], nextCursor?: string }) => page.items) || []

	return (
		<div className="min-h-screen bg-background-secondary">
			<Navbar isConnected={sseConnected} user={user} onLogout={logout} />
			<div className="max-w-6xl mx-auto py-8 px-4 flex gap-6">
				{/* Main Content */}
				<div className="flex-1 min-w-0 relative">
					{/* page header */}
					<div className="flex justify-between items-center mb-6">
						<h1 className="text-2xl font-bold text-text-primary">Home</h1>
						{user && (
							<Link to="/events/new">
								<Button variant="primary" size="sm">
									<AddIcon className="w-4 h-4 mr-2" />
									New Event
								</Button>
							</Link>
						)}
					</div>

					<div className="space-y-6" style={{ overflowAnchor: 'none' }}>
						{/* Refetching Indicator */}
						{isRefetching && (
							<div className="absolute left-0 right-0 z-20 flex justify-center py-4 animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-none">
								<div className="bg-background-primary rounded-full p-2 shadow-lg border border-border-default">
									<Spinner size="sm" className="text-primary-600" />
								</div>
							</div>
						)}

						{allItems.length === 0 ? (
							<Card variant="default" padding="lg" className="text-center">
								<h3 className="text-lg font-medium text-text-primary mb-2">Welcome!</h3>
								<p className="text-text-secondary">Follow people to see their activity here.</p>
							</Card>
						) : (
							allItems.map((item: FeedItem) => {
								const key = `${item.type}-${item.id}`

								switch (item.type) {
									case 'header': {
										const validated = getHeaderData(item.data)
										if (validated) {
											const { title } = validated
											return (
												<div key={key} className="pt-4 pb-2">
													<h2 className="text-lg font-semibold text-text-primary border-b border-border-default pb-2">
														{title}
													</h2>
												</div>
											)
										}
										return null
									}

									case 'onboarding': {
										const validated = getSuggestedUsersData(item.data)
										if (validated) {
											return <OnboardingHero key={key} suggestions={validated.suggestions} />
										}
										return null
									}

									case 'suggested_users': {
										const validated = getSuggestedUsersData(item.data)
										if (validated) {
											return <SuggestedUsersCard key={key} users={validated.suggestions} />
										}
										return null
									}

									case 'trending_event': {
										const validated = getTrendingEventData(item.data)
										if (validated) {
											return (
												<div key={key} className="h-full">
													<EventCard event={validated} isAuthenticated={Boolean(user)} />
												</div>
											)
										}
										return null
									}

									case 'activity': {
										const validated = getActivityData(item.data)
										if (validated) {
											// For "Smart Agenda", we show the Event itself
											return (
												<div key={key} className="h-full">
													<EventCard event={validated.event} isAuthenticated={Boolean(user)} />
												</div>
											)
										}
										return null
									}

									default:
										return null
								}
							})
						)}
					</div>

					{/* Load More Trigger */}
					{hasNextPage && (
						<div ref={loadMoreRef} className="h-10 mt-6 flex justify-center">
							{isFetchingNextPage && <Spinner size="sm" />}
						</div>
					)}

					{!hasNextPage && allItems.length > 0 && (
						<p className="text-center text-sm text-text-tertiary mt-8 mb-8">
							You&apos;ve reached the end of your agenda.
						</p>
					)}
				</div>

				{/* Sidebar (Desktop only) */}
				<Sidebar />
			</div>
		</div>
	)
}
