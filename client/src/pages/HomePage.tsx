import { Link } from 'react-router-dom'

import { CommunityStats } from '@/components/CommunityStats'
import { EventCard } from '@/components/EventCard'
import { HomeHero } from '@/components/HomeHero'
import { Container, Section } from '@/components/layout'
import { Navbar } from '@/components/Navbar'
import { Button, Skeleton } from '@/components/ui'
import {
	useEvents,
	usePlatformStats,
	useRecommendedEvents,
	useTrendingEvents,
} from '@/hooks/queries'
import { useUIStore } from '@/stores'

import { useAuth } from '../hooks/useAuth'

export function HomePage() {
	const { user, logout } = useAuth()
	const { sseConnected } = useUIStore()
	// const navigate = useNavigate()

	// Queries
	const { data: eventsData, isLoading: eventsLoading } = useEvents(10)
	const { data: trendingData, isLoading: trendingLoading } = useTrendingEvents(6, 7)
	const { data: recommendationsData, isLoading: recommendationsLoading } = useRecommendedEvents(
		6,
		{
			enabled: Boolean(user),
		}
	)
	const { data: statsData, isLoading: statsLoading } = usePlatformStats()

	// Derived data
	const upcomingEvents =
		eventsData?.events.filter((e) => new Date(e.startTime) > new Date()) || []
	const trendingEvents = trendingData?.events || []
	const recommendedEvents = recommendationsData?.recommendations.map((r) => r.event) || []

	const totalEvents = statsData?.totalEvents ?? eventsData?.pagination.total ?? 0
	const totalUsers = statsData?.totalUsers ?? 0
	const totalInstances = statsData?.totalInstances ?? 0

	return (
		<div className="min-h-screen bg-background-secondary">
			<Navbar isConnected={sseConnected} user={user} onLogout={logout} />

			{/* Hero Section */}
			<HomeHero isAuthenticated={Boolean(user)} />

			{/* Stats Section */}
			<Section
				variant="default"
				padding="lg"
				className="border-b border-border-default bg-white dark:bg-background-primary">
				<Container>
					<CommunityStats
						totalEvents={totalEvents}
						totalUsers={totalUsers}
						totalInstances={totalInstances}
						isLoading={statsLoading}
					/>
				</Container>
			</Section>

			{/* Trending Section */}
			<Section variant="muted" padding="lg">
				<Container>
					<div className="flex items-end justify-between mb-6">
						<div>
							<h2 className="text-2xl font-bold text-text-primary">
								🔥 Trending Now
							</h2>
							<p className="text-text-secondary mt-1">
								Popular events in the network
							</p>
						</div>
						<Link to="/discover?sort=trending">
							<Button variant="ghost" size="sm">
								View All →
							</Button>
						</Link>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
						{trendingLoading
							? Array.from({ length: 3 }).map((_, i) => (
									<div key={`trending-skeleton-${i}`} className="h-full">
										<Skeleton className="h-64 w-full rounded-xl" />
									</div>
								))
							: trendingEvents.slice(0, 3).map((event) => (
									<div key={event.id} className="h-full">
										<EventCard
											event={event}
											isAuthenticated={Boolean(user)}
											variant="full"
										/>
									</div>
								))}
						{!trendingLoading && trendingEvents.length === 0 && (
							<div className="col-span-full py-8 text-center text-text-secondary bg-background-primary rounded-xl border border-border-default border-dashed">
								No trending events right now. Be the first to create a buzz!
							</div>
						)}
					</div>
				</Container>
			</Section>

			{/* Recommendations (Authenticated) */}
			{user && (
				<Section variant="default" padding="lg">
					<Container>
						<div className="flex items-end justify-between mb-6">
							<div>
								<h2 className="text-2xl font-bold text-text-primary">✨ For You</h2>
								<p className="text-text-secondary mt-1">
									Events tailored to your interests
								</p>
							</div>
						</div>

						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
							{recommendationsLoading
								? Array.from({ length: 3 }).map((_, i) => (
										<div key={`rec-skeleton-${i}`} className="h-full">
											<Skeleton className="h-64 w-full rounded-xl" />
										</div>
									))
								: recommendedEvents.slice(0, 3).map((event) => (
										<div key={event.id} className="h-full">
											<EventCard
												event={event}
												isAuthenticated={Boolean(user)}
												variant="full"
											/>
										</div>
									))}
							{!recommendationsLoading && recommendedEvents.length === 0 && (
								<div className="col-span-full py-8 text-center text-text-secondary bg-background-secondary rounded-xl border border-border-default border-dashed">
									Interact with more events to get personalized recommendations.
								</div>
							)}
						</div>
					</Container>
				</Section>
			)}

			{/* Upcoming Section */}
			<Section variant={user ? 'muted' : 'default'} padding="lg">
				<Container>
					<div className="flex items-end justify-between mb-6">
						<div>
							<h2 className="text-2xl font-bold text-text-primary">🗓️ Upcoming</h2>
							<p className="text-text-secondary mt-1">Happening soon</p>
						</div>
						<Link to="/discover?sort=date">
							<Button variant="ghost" size="sm">
								View Calendar →
							</Button>
						</Link>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
						{eventsLoading
							? Array.from({ length: 4 }).map((_, i) => (
									<div key={`events-skeleton-${i}`} className="h-full">
										<Skeleton className="h-48 w-full rounded-xl" />
									</div>
								))
							: upcomingEvents.slice(0, 4).map((event) => (
									<div key={event.id} className="h-full">
										<EventCard
											event={event}
											isAuthenticated={Boolean(user)}
											variant="compact"
										/>
									</div>
								))}
						{!eventsLoading && upcomingEvents.length === 0 && (
							<div className="col-span-full py-12 text-center text-text-secondary">
								No upcoming events found.
							</div>
						)}
					</div>
				</Container>
			</Section>

			{/* CTA Footer */}
			{!user && (
				<Section
					variant="accent"
					padding="xl"
					className="text-center border-t border-border-default">
					<Container size="sm">
						<h2 className="text-3xl font-bold text-text-primary mb-4">
							Ready to Join?
						</h2>
						<p className="text-text-secondary text-lg mb-8">
							Create your own events, follow others, and become part of the
							decentralized event network.
						</p>
						<Link to="/login?signup=true">
							<Button
								variant="primary"
								size="lg"
								className="shadow-lg hover:shadow-primary-500/25">
								Create an Account
							</Button>
						</Link>
					</Container>
				</Section>
			)}
		</div>
	)
}
