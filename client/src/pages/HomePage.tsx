import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'

import { Container, Section } from '@/components/layout'
import { Button, Spinner } from '@/components/ui'
import {
	useEvents,
	useRecommendedEvents,
	useTrendingEvents,
	usePlatformStats,
} from '@/hooks/queries'
import { useUIStore } from '@/stores'

import { EventCard } from '../components/EventCard'
import { EventStats } from '../components/EventStats'
import { HomeHero } from '../components/HomeHero'
import { Navbar } from '../components/Navbar'
import { useAuth } from '../hooks/useAuth'

export function HomePage() {
	const { user, logout } = useAuth()
	const { data, isLoading } = useEvents(100)
	const { data: recommendationsData, isLoading: recommendationsLoading } = useRecommendedEvents(
		6,
		{
			enabled: Boolean(user),
		}
	)
	const { data: trendingData, isLoading: trendingLoading } = useTrendingEvents(6, 7)
	const { data: statsData, isLoading: statsLoading } = usePlatformStats()
	const { sseConnected } = useUIStore()

	const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)

	// Get user geolocation for location-based events (with user permission)
	useEffect(() => {
		if (!navigator.geolocation) return

		// eslint-disable-next-line sonarjs/no-intrusive-permissions
		navigator.geolocation.getCurrentPosition(
			(position) => {
				setUserLocation({
					lat: position.coords.latitude,
					lng: position.coords.longitude,
				})
			},
			() => {
				// User denied location or error occurred - location-based events won't show
			}
		)
	}, [])

	const events = data?.events || []

	// Get upcoming events (soonest first)
	const now = new Date()
	const upcomingEventsList = events
		.filter((e) => new Date(e.startTime) > now)
		.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
		.slice(0, 6)

	// Get location-based events (if location available)
	const locationBasedEvents = userLocation
		? events
				.filter((e) => {
					if (!e.locationLatitude || !e.locationLongitude) return false
					// Simple distance calculation (within ~50km)
					const latDiff = Math.abs(e.locationLatitude - userLocation.lat)
					const lngDiff = Math.abs(e.locationLongitude - userLocation.lng)
					return latDiff < 1 && lngDiff < 1
				})
				.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
				.slice(0, 6)
		: []

	// Get featured/trending events
	const trendingEvents = trendingData?.events || []
	const recommendations = recommendationsData?.recommendations || []

	// Use platform statistics from backend (accurate counts)
	// Fall back to client-side calculation if stats are not available
	const totalEvents = statsData?.totalEvents ?? events.length
	const statsUpcomingEvents =
		statsData?.upcomingEvents ?? events.filter((e) => new Date(e.startTime) > new Date()).length
	const todayEventsCount = statsData?.todayEvents ?? 0

	return (
		<div className="min-h-screen bg-background-primary">
			<Navbar isConnected={sseConnected} user={user} onLogout={logout} />

			{/* Hero Section */}
			<HomeHero isAuthenticated={Boolean(user)} />

			{/* Platform Statistics Section */}
			<Section variant="muted" padding="lg">
				<Container>
					<div className="space-y-6">
						<div className="text-center space-y-2">
							<h2 className="text-3xl font-bold text-text-primary">
								Platform Statistics
							</h2>
							<p className="text-text-secondary">
								Join a growing network of event organizers and attendees
							</p>
						</div>

						<EventStats
							totalEvents={totalEvents}
							upcomingEvents={statsUpcomingEvents}
							todayEvents={todayEventsCount}
							isLoading={isLoading || statsLoading}
						/>
					</div>
				</Container>
			</Section>

			{/* Recommendations for authenticated users */}
			{user && recommendations.length > 0 && (
				<Section variant="default" padding="lg">
					<Container>
						<div className="space-y-6">
							<div className="flex items-center justify-between">
								<div>
									<h2 className="text-3xl font-bold text-text-primary">
										✨ Recommended for You
									</h2>
									<p className="text-text-secondary mt-1">
										Events tailored to your interests
									</p>
								</div>
								{recommendationsData?.metadata?.generatedAt && (
									<span className="text-sm text-text-secondary">
										Updated{' '}
										{new Date(
											recommendationsData.metadata.generatedAt
										).toLocaleTimeString()}
									</span>
								)}
							</div>

							{recommendationsLoading ? (
								<div className="flex items-center justify-center py-12">
									<Spinner size="lg" />
								</div>
							) : (
								<>
									<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
										{recommendations.slice(0, 6).map((item) => (
											<EventCard
												key={item.event.id}
												event={item.event}
												isAuthenticated={Boolean(user)}
											/>
										))}
									</div>
									<div className="text-center pt-4">
										<Link to="/search">
											<Button variant="secondary" size="lg">
												Discover More Events
											</Button>
										</Link>
									</div>
								</>
							)}
						</div>
					</Container>
				</Section>
			)}

			{/* Location-based Events Section */}
			{locationBasedEvents.length > 0 && (
				<Section variant="muted" padding="lg">
					<Container>
						<div className="space-y-6">
							<div>
								<h2 className="text-3xl font-bold text-text-primary">
									📍 Events Near You
								</h2>
								<p className="text-text-secondary mt-1">
									Discover events happening in your area
								</p>
							</div>

							<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
								{locationBasedEvents.slice(0, 6).map((event) => (
									<EventCard
										key={event.id}
										event={event}
										isAuthenticated={Boolean(user)}
									/>
								))}
							</div>

							<div className="text-center pt-4">
								<Link to="/search">
									<Button variant="secondary" size="lg">
										Explore by Location
									</Button>
								</Link>
							</div>
						</div>
					</Container>
				</Section>
			)}

			{/* Trending Events Section */}
			{trendingEvents.length > 0 && (
				<Section variant="default" padding="lg">
					<Container>
						<div className="space-y-6">
							<div>
								<h2 className="text-3xl font-bold text-text-primary">
									🔥 Trending Events
								</h2>
								<p className="text-text-secondary mt-1">
									Popular events happening soon in the network
								</p>
							</div>

							{trendingLoading ? (
								<div className="flex items-center justify-center py-12">
									<Spinner size="lg" />
								</div>
							) : (
								<>
									<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
										{trendingEvents.slice(0, 6).map((event) => (
											<EventCard
												key={event.id}
												event={event}
												isAuthenticated={Boolean(user)}
											/>
										))}
									</div>
									<div className="text-center pt-4">
										<Link to="/search">
											<Button variant="secondary" size="lg">
												Browse All Events
											</Button>
										</Link>
									</div>
								</>
							)}
						</div>
					</Container>
				</Section>
			)}

			{/* Upcoming Events Section */}
			{upcomingEventsList.length > 0 && (
				<Section variant="muted" padding="lg">
					<Container>
						<div className="space-y-6">
							<div className="flex items-center justify-between">
								<div>
									<h2 className="text-3xl font-bold text-text-primary">
										📅 Upcoming Events
									</h2>
									<p className="text-text-secondary mt-1">
										Happening soon, in order
									</p>
								</div>
								<Link to="/calendar">
									<Button variant="ghost" size="md">
										View Calendar →
									</Button>
								</Link>
							</div>

							{isLoading ? (
								<div className="flex items-center justify-center py-12">
									<Spinner size="lg" />
								</div>
							) : (
								<>
									<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
										{upcomingEventsList.slice(0, 6).map((event) => (
											<EventCard
												key={event.id}
												event={event}
												isAuthenticated={Boolean(user)}
											/>
										))}
									</div>
									<div className="text-center pt-4">
										<Link to="/search">
											<Button variant="secondary" size="lg">
												Search Events
											</Button>
										</Link>
									</div>
								</>
							)}
						</div>
					</Container>
				</Section>
			)}

			{/* Sign Up CTA for unauthenticated users */}
			{!user && (
				<Section variant="default" padding="lg">
					<Container>
						<div className="card p-8 bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 border-2 border-primary-200 dark:border-primary-800">
							<div className="text-center max-w-2xl mx-auto">
								<div className="text-5xl mb-4">✨</div>
								<h2 className="text-4xl font-bold text-text-primary mb-3">
									Ready to Organize?
								</h2>
								<p className="text-text-secondary mb-6 text-lg">
									Create and manage events on the federated web. Sign up for free
									and start building your event community.
								</p>
								<div className="flex flex-col sm:flex-row gap-4 justify-center">
									<Link to="/login" className="flex-1 sm:flex-none">
										<Button variant="primary" size="lg" fullWidth>
											Sign Up Free
										</Button>
									</Link>
									<Link to="/search" className="flex-1 sm:flex-none">
										<Button variant="secondary" size="lg" fullWidth>
											Browse Events
										</Button>
									</Link>
								</div>
								<p className="text-sm text-text-secondary mt-6">
									Learn more about{' '}
									<Link
										to="/about"
										className="text-primary-600 dark:text-primary-400 hover:underline font-medium">
										self-hosting Constellate
									</Link>{' '}
									or{' '}
									<Link
										to="/about"
										className="text-primary-600 dark:text-primary-400 hover:underline font-medium">
										federation
									</Link>
									.
								</p>
							</div>
						</div>
					</Container>
				</Section>
			)}
		</div>
	)
}
