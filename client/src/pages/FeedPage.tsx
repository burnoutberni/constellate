import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

import { ActivityFeedItem } from '@/components/ActivityFeedItem'
import { OnboardingHero } from '@/components/Feed/OnboardingHero'
import { SuggestedUsersCard } from '@/components/Feed/SuggestedUsersCard'
import { TrendingEventCard, TrendingEvent } from '@/components/Feed/TrendingEventCard'
import { Navbar } from '@/components/Navbar'
import { Button, Card, Spinner, AddIcon } from '@/components/ui'
import { useActivityFeed, type FeedItem } from '@/hooks/queries'
import { useAuth } from '@/hooks/useAuth'
import { useUIStore } from '@/stores'
import { Activity, SuggestedUser } from '@/types'

// Type guards
function isSuggestedUsersData(data: unknown): data is { suggestions: SuggestedUser[] } {
	return (
		typeof data === 'object' &&
		data !== null &&
		'suggestions' in data &&
		Array.isArray((data as Record<string, unknown>).suggestions)
	)
}

function isTrendingEventData(data: unknown): data is TrendingEvent {
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
		'createdAt' in data
	)
}

export function FeedPage() {
	const { user, logout } = useAuth()
	const { sseConnected } = useUIStore()

	// Unified Feed Query
	const {
		data,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		refetch,
		status,
		error
	} = useActivityFeed()

	// Infinite Scroll Intersection Observer
	const loadMoreRef = useRef<HTMLDivElement>(null)

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
				<div className="max-w-2xl mx-auto py-8 px-4">
					<Card variant="default" padding="lg" className="text-center">
						<Spinner size="md" />
					</Card>
				</div>
			</div>
		)
	}

	if (status === 'error') {
		const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
		return (
			<div className="min-h-screen bg-background-secondary">
				<Navbar isConnected={sseConnected} user={user} onLogout={logout} />
				<div className="max-w-2xl mx-auto py-8 px-4">
					<Card variant="default" padding="lg" className="text-center text-error-600">
						<p>Failed to load feed.</p>
						<p className="text-sm mt-2">{errorMessage}</p>
						<Button variant="primary" size="sm" className="mt-4" onClick={() => refetch()}>
							Retry
						</Button>
					</Card>
				</div>
			</div>
		)
	}

	const allItems = data?.pages?.flatMap((page) => page.items) || []

	// Empty State (Should be rare due to onboarding hero, but good fallback)
	if (allItems.length === 0) {
		return (
			<div className="min-h-screen bg-background-secondary">
				<Navbar isConnected={sseConnected} user={user} onLogout={logout} />
				<div className="max-w-2xl mx-auto py-8 px-4">
					<div className="flex justify-between items-center mb-6">
						<h1 className="text-2xl font-bold text-text-primary">Home</h1>
						<Link to="/events/new">
							<Button variant="primary" size="sm">
								<AddIcon className="w-4 h-4 mr-2" />
								New Event
							</Button>
						</Link>
					</div>
					<Card variant="default" padding="lg" className="text-center">
						<h3 className="text-lg font-medium text-text-primary mb-2">Welcome!</h3>
						<p className="text-text-secondary">Follow people to see their activity here.</p>
					</Card>
				</div>
			</div>
		)
	}

	return (
		<div className="min-h-screen bg-background-secondary">
			<Navbar isConnected={sseConnected} user={user} onLogout={logout} />
			<div className="max-w-2xl mx-auto py-8 px-4">
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

				<div className="space-y-6">
					{allItems.map((item: FeedItem) => {
						// Use a composite key or item.id if unique 
						// (backend guarantees item.id uniqueness mostly, but good to be safe)
						const key = `${item.type}-${item.id}`

						switch (item.type) {
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
									return <TrendingEventCard key={key} event={item.data} />
								}
								return null
							}

							case 'activity': {
								if (isActivityData(item.data)) {
									return <ActivityFeedItem key={key} activity={item.data} />
								}
								return null
							}

							default:
								return null
						}
					})}
				</div>

				{/* Load More Trigger */}
				<div ref={loadMoreRef} className="h-10 mt-6 flex justify-center">
					{isFetchingNextPage && <Spinner size="sm" />}
				</div>

				{!hasNextPage && allItems.length > 0 && (
					<p className="text-center text-sm text-text-tertiary mt-8">
						You&apos;ve reached the end of the feed.
					</p>
				)}
			</div>
		</div>
	)
}
