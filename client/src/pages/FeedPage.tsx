import { useEffect, useRef, useState, useMemo } from 'react'

import { CreateEventModal } from '@/components/CreateEventModal'
import { FeedItemRenderer } from '@/components/Feed/FeedItem'
import { Sidebar } from '@/components/Feed/Sidebar'
import { Navbar } from '@/components/Navbar'
import { Button, Card, Spinner, AddIcon } from '@/components/ui'
import { useHomeFeed, type FeedItem } from '@/hooks/queries'
import { useAuth } from '@/hooks/useAuth'
import { useUIStore } from '@/stores'

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


	// Bolt: Memoize allItems to prevent unnecessary re-creation on every render
	const allItems = useMemo(() =>
		data?.pages?.flatMap((page: { items: FeedItem[], nextCursor?: string }) => page.items) || [],
		[data]
	)

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

						{allItems.length === 0 ? (
							<Card variant="default" padding="lg" className="text-center">
								<h3 className="text-lg font-medium text-text-primary mb-2">Welcome!</h3>
								<p className="text-text-secondary">Follow people to see their activity here.</p>
							</Card>
						) : (
							allItems.map((item: FeedItem) => (
								<FeedItemRenderer
									key={`${item.type}-${item.id}`}
									item={item}
									isAuthenticated={Boolean(user)}
								/>
							))
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
