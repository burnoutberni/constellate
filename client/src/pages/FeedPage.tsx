import { useEffect, useMemo, useRef, useState } from 'react'
import { z } from 'zod'

import { CreateEventModal } from '@/components/CreateEventModal'
import { EventCard } from '@/components/EventCard'
import { OnboardingHero } from '@/components/Feed/OnboardingHero'
import { Sidebar } from '@/components/Feed/Sidebar'
import { SuggestedUsersCard } from '@/components/Feed/SuggestedUsersCard'
import { Navbar } from '@/components/Navbar'
import { Button, Card, Spinner, AddIcon } from '@/components/ui'
import { useHomeFeed, type FeedItem } from '@/hooks/queries'
import { useAuth } from '@/hooks/useAuth'
import { logger } from '@/lib/logger'
import { useUIStore } from '@/stores'
import {
	HeaderSchema,
	SuggestedUsersSchema,
	EventSchema,
	ActivitySchema
} from '@/types'

// Validation helpers
// Validation helpers

// Validation helpers

function getValidatedData<T extends z.ZodTypeAny>(
	schema: T,
	data: unknown,
	context: string
): z.infer<T> | null {
	const result = schema.safeParse(data)
	if (!result.success) {
		logger.error(`FeedPage: Invalid ${context} data`, result.error)
		return null
	}
	return result.data
}

export function FeedPage() {
	const { user, logout } = useAuth()
	const { sseConnected, isFeedRefreshing } = useUIStore()
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

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

	const feedItems = useMemo(() => {
		const rawItems =
			data?.pages?.flatMap(
				(page: { items: FeedItem[]; nextCursor?: string }) => page.items
			) || []

		return rawItems.map((item) => {
			let validatedData = null

			switch (item.type) {
				case 'header':
					validatedData = getValidatedData(HeaderSchema, item.data, 'header')
					break
				case 'onboarding':
					validatedData = getValidatedData(
						SuggestedUsersSchema,
						item.data,
						'onboarding'
					)
					break
				case 'suggested_users':
					validatedData = getValidatedData(
						SuggestedUsersSchema,
						item.data,
						'suggested_users'
					)
					break
				case 'trending_event':
					validatedData = getValidatedData(EventSchema, item.data, 'trending_event')
					break
				case 'activity':
					validatedData = getValidatedData(ActivitySchema, item.data, 'activity')
					break
				default:
					break
			}
			return { ...item, validatedData }
		})
	}, [data])

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


	// If not authenticated, the query is disabled so status stays pending/idle
	// We only show loading spinner if we are explicitly loading (isFetching)
	// OR if we are authenticated (so we expect data eventually)
	if (status === 'pending' && (isFetching || Boolean(user))) {
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
							<Button
								variant="primary"
								size="sm"
								onClick={() => setIsCreateModalOpen(true)}
							>
								<AddIcon className="w-4 h-4 mr-2" />
								New Event
							</Button>
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

						{feedItems.length === 0 ? (
							<Card variant="default" padding="lg" className="text-center">
								<h3 className="text-lg font-medium text-text-primary mb-2">
									Welcome!
								</h3>
								<p className="text-text-secondary">
									Follow people to see their activity here.
								</p>
							</Card>
						) : (
							feedItems.map((item) => {
								const key = `${item.type}-${item.id}`
								const validated = item.validatedData

								if (!validated) {
									return null
								}

								switch (item.type) {
									case 'header': {
										const { title } = validated as z.infer<typeof HeaderSchema>
										return (
											<div key={key} className="pt-4 pb-2">
												<h2 className="text-lg font-semibold text-text-primary border-b border-border-default pb-2">
													{title}
												</h2>
											</div>
										)
									}

									case 'onboarding': {
										const suggestionsData = validated as z.infer<typeof SuggestedUsersSchema>
										return (
											<OnboardingHero key={key} suggestions={suggestionsData.suggestions} />
										)
									}

									case 'suggested_users': {
										const suggestionsData = validated as z.infer<typeof SuggestedUsersSchema>
										return (
											<SuggestedUsersCard key={key} users={suggestionsData.suggestions} />
										)
									}

									case 'trending_event': {
										const event = validated as z.infer<typeof EventSchema>
										return (
											<div key={key} className="h-full">
												<EventCard
													event={event}
													isAuthenticated={Boolean(user)}
												/>
											</div>
										)
									}

									case 'activity': {
										const activity = validated as z.infer<typeof ActivitySchema>
										// For "Smart Agenda", we show the Event itself
										return (
											<div key={key} className="h-full">
												{activity.event && (
													<EventCard
														event={activity.event}
														isAuthenticated={Boolean(user)}
													/>
												)}
											</div>
										)
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

					{!hasNextPage && feedItems.length > 0 && (
						<p className="text-center text-sm text-text-tertiary mt-8 mb-8">
							You&apos;ve reached the end of your agenda.
						</p>
					)}
				</div>

				{/* Sidebar (Desktop only) */}
				<Sidebar />
			</div>

			{/* Create Event Modal */}
			<CreateEventModal
				isOpen={isCreateModalOpen}
				onClose={() => setIsCreateModalOpen(false)}
				onSuccess={() => {
					setIsCreateModalOpen(false)
					refetch()
				}}
			/>
		</div>
	)
}
