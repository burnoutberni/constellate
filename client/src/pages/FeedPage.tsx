import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

import { EventCard } from '@/components/EventCard'
import { OnboardingHero } from '@/components/Feed/OnboardingHero'
import { Sidebar } from '@/components/Feed/Sidebar'
import { SuggestedUsersCard } from '@/components/Feed/SuggestedUsersCard'
import { Navbar } from '@/components/Navbar'
import { Button, Card, Spinner, AddIcon } from '@/components/ui'
import { useHomeFeed, type FeedItem } from '@/hooks/queries'
import { useAuth } from '@/hooks/useAuth'
import { useUIStore } from '@/stores'
import { Activity, SuggestedUser, Event } from '@/types'

// Type guards
function isSuggestedUsersData(data: unknown): data is { suggestions: SuggestedUser[] } {
	return (
		typeof data === 'object' &&
		data !== null &&
		'suggestions' in data &&
		Array.isArray((data as Record<string, unknown>).suggestions)
	)
}

function isTrendingEventData(data: unknown): data is Event {
	return (
		typeof data === 'object' &&
		data !== null &&
		'title' in data &&
		'startTime' in data
	)
}

function isActivityData(data: unknown): data is Activity {
	return (
		typeof data === 'object' &&
		data !== null &&
		'type' in data &&
		'createdAt' in data &&
		'event' in data
	)
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
										const {title} = (item.data as { title: string })
										return (
											<div key={key} className="pt-4 pb-2">
												<h2 className="text-lg font-semibold text-text-primary border-b border-border-default pb-2">
													{title}
												</h2>
											</div>
										)
									}

									case 'onboarding': {
										if (isSuggestedUsersData(item.data)) {
											return <OnboardingHero key={key} suggestions={item.data.suggestions} />
										}
										return null
									}

									case 'suggested_users': {
										if (isSuggestedUsersData(item.data)) {
											return <SuggestedUsersCard key={key} users={item.data.suggestions} />
										}
										return null
									}

									case 'trending_event': {
										if (isTrendingEventData(item.data)) {
											return (
												<div key={key} className="h-full">
													<EventCard event={item.data} isAuthenticated={Boolean(user)} />
												</div>
											)
										}
										return null
									}

									case 'activity': {
										if (isActivityData(item.data)) {
											// For "Smart Agenda", we show the Event itself
											return (
												<div key={key} className="h-full">
													<EventCard event={item.data.event} isAuthenticated={Boolean(user)} />
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
