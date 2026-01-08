import { useQueryClient } from '@tanstack/react-query'
import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

import { EventCard } from '@/components/EventCard'
import {
	/* Components */
	Button,
	Card,
} from '@/components/ui'
import { useEvents, queryKeys } from '@/hooks/queries'
import { useAuth } from '@/hooks/useAuth'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import { useRealtime } from '@/hooks/useRealtime'
import { api } from '@/lib/api-client'
import { useUIStore } from '@/stores'
import type { Event } from '@/types'

import { CalendarEventPopup } from '../components/CalendarEventPopup'
import { CalendarNavigation } from '../components/CalendarNavigation'
import { CalendarView } from '../components/CalendarView'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { Navbar } from '../components/Navbar'
import { eventsWithinRange } from '../lib/recurrence'


export function CalendarPage() {

	const navigate = useNavigate()
	const handleError = useErrorHandler()
	const addToast = useUIStore((state) => state.addToast)
	const queryClient = useQueryClient()
	const [currentDate, setCurrentDate] = useState(new Date())
	const [view, setView] = useState<'month' | 'week' | 'day'>('month')
	const [selectedEvent, setSelectedEvent] = useState<{
		event: Event
		position: { x: number; y: number }
	} | null>(null)
	const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false)
	const [subscriptionUrl, setSubscriptionUrl] = useState<string | null>(null)

	const dateRange = useMemo(() => {
		let start: Date, end: Date

		if (view === 'month') {
			start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
			end = new Date(
				currentDate.getFullYear(),
				currentDate.getMonth() + 1,
				0,
				23,
				59,
				59,
				999
			)
		} else if (view === 'week') {
			const weekStartDate = currentDate.getDate() - currentDate.getDay()
			start = new Date(
				currentDate.getFullYear(),
				currentDate.getMonth(),
				weekStartDate,
				0,
				0,
				0,
				0
			)
			end = new Date(
				currentDate.getFullYear(),
				currentDate.getMonth(),
				weekStartDate + 6,
				23,
				59,
				59,
				999
			)
		} else {
			start = new Date(
				currentDate.getFullYear(),
				currentDate.getMonth(),
				currentDate.getDate(),
				0,
				0,
				0,
				0
			)
			end = new Date(
				currentDate.getFullYear(),
				currentDate.getMonth(),
				currentDate.getDate(),
				23,
				59,
				59,
				999
			)
		}

		return {
			start,
			end,
			startMs: start.getTime(),
			endMs: end.getTime(),
		}
	}, [currentDate, view])

	const { user, logout } = useAuth()



	// Real-time updates
	// Since we are using useQuery, we should invalidate queries on updates
	// rather than managing local state
	const handleRealtimeEvent = useCallback(
		() => {
			// Invalidate the events list query to refetch data
			// We use the exact same key params as the hook
			queryClient.invalidateQueries({
				queryKey: queryKeys.events.list({
					limit: 500,
					rangeStart: dateRange.start.toISOString(),
					rangeEnd: dateRange.end.toISOString(),
					onlyMine: true,
				})
			})
		},
		[queryClient, dateRange]
	)

	const { isConnected } = useRealtime({
		onEvent: handleRealtimeEvent,
	})

	// Memoize ISO strings to prevent infinite loop
	const rangeStartISO = useMemo(() => dateRange.start.toISOString(), [dateRange.start])
	const rangeEndISO = useMemo(() => dateRange.end.toISOString(), [dateRange.end])

	// Fetch events using hook
	const { data: eventsData, isLoading } = useEvents({
		limit: 500,
		rangeStart: rangeStartISO,
		rangeEnd: rangeEndISO,
		onlyMine: true,
	})

	const events = useMemo(() => eventsData?.events || [], [eventsData])

	// Calendar helpers
	const rangeEvents = useMemo(
		() => eventsWithinRange(events, dateRange.start, dateRange.end),
		[events, dateRange.start, dateRange.end]
	)

	const upcomingEvents = useMemo(() => {
		const now = new Date()
		const withinRange = eventsWithinRange(events, now, dateRange.end)
		return withinRange
			.filter((event) => new Date(event.startTime) >= now)
			.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
	}, [events, dateRange.end])

	const getDisplayText = () => {
		if (view === 'month') {
			return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
		}
		if (view === 'week') {
			const { start: startOfWeek, end: endOfWeek } = dateRange

			if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
				return `${startOfWeek.toLocaleDateString('en-US', { month: 'long' })} ${startOfWeek.getDate()} - ${endOfWeek.getDate()}, ${startOfWeek.getFullYear()}`
			}
			return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${endOfWeek.getFullYear()}`
		}
		return currentDate.toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			year: 'numeric',
		})
	}

	const handleEventClick = useCallback((event: Event, position: { x: number; y: number }) => {
		setSelectedEvent({ event, position })
	}, [])

	const handleNavigateToEvent = useCallback(
		(eventId: string) => {
			navigate(`/events/${eventId}`)
		},
		[navigate]
	)

	const handleExportICS = useCallback(
		async (eventId: string) => {
			try {
				const response = await fetch(`/api/calendar/${eventId}/export.ics`)
				if (!response.ok) {
					throw new Error('Failed to export calendar')
				}
				const blob = await response.blob()
				const url = window.URL.createObjectURL(blob)
				const a = document.createElement('a')
				a.href = url
				a.download = `event-${eventId}.ics`
				document.body.appendChild(a)
				a.click()
				window.URL.revokeObjectURL(url)
				document.body.removeChild(a)
			} catch (error) {
				handleError(error, 'Failed to export event. Please try again.', {
					context: 'CalendarPage.handleExportICS',
				})
			}
		},
		[handleError]
	)

	const handleExportGoogle = useCallback(
		async (eventId: string) => {
			try {
				const data = await api.get<{ url?: string }>(
					`/calendar/${eventId}/export/google`,
					undefined,
					undefined,
					'Failed to generate Google Calendar link'
				)
				if (data.url) {
					window.open(data.url, '_blank', 'noopener,noreferrer')
				} else {
					throw new Error('No URL returned from server')
				}
			} catch (error) {
				handleError(error, 'Failed to export to Google Calendar. Please try again.', {
					context: 'CalendarPage.handleExportGoogle',
				})
			}
		},
		[handleError]
	)

	return (
		<div className="min-h-screen bg-background-primary">
			<Navbar isConnected={isConnected} user={user} onLogout={logout} />

			{/* Calendar Controls */}
			<div className="max-w-6xl mx-auto px-4 py-4">
				<CalendarNavigation
					view={view}
					currentDate={currentDate}
					onViewChange={setView}
					onDateChange={setCurrentDate}
					displayText={getDisplayText()}
				/>
			</div>

			{/* Main Content */}
			<div className="max-w-6xl mx-auto px-4 py-6">
				<div className="grid lg:grid-cols-3 gap-6">
					{/* Calendar Card */}
					<div className="lg:col-span-2">
						<ErrorBoundary resetKeys={[view, currentDate.toISOString()]}>
							<Card>
								<CalendarView
									view={view}
									currentDate={currentDate}
									events={rangeEvents}
									loading={isLoading}
									onEventClick={handleEventClick}
								/>
							</Card>
						</ErrorBoundary>
					</div>

					{/* Upcoming Events Sidebar */}
					<div className="space-y-4">
						<Card>
							<h2 className="font-bold text-lg mb-4">My Upcoming Events</h2>
							<div className="space-y-3">
								{upcomingEvents.length === 0 ? (
									<p className="text-sm text-text-secondary">
										No upcoming events
									</p>
								) : (
									<div className="space-y-4">
										{upcomingEvents.slice(0, 5).map((event) => (
											<div key={event.id} className="h-full">
												<EventCard
													event={event}
													variant="compact"
													isAuthenticated={Boolean(user)}
												/>
											</div>
										))}
									</div>
								)}
							</div>
						</Card>

						{/* Calendar Export */}
						{user && (
							<Card>
								<h2 className="font-bold text-lg mb-4">Export My Calendar</h2>
								<p className="text-sm text-text-secondary mb-4">
									Export your calendar feed to add events to your calendar
									application.
								</p>
								<div className="text-sm">
									<Button
										variant="outline"
										className="w-full justify-center"
										onClick={() => setIsSubscriptionModalOpen(true)}>
										Get Private Feed URL
									</Button>
								</div>
							</Card>
						)}
					</div>
				</div>
			</div >

			{/* Subscription Modal */}
			{
				isSubscriptionModalOpen && (
					<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
						<div className="bg-background-primary rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
							<h3 className="text-lg font-bold">Subscribe to My Events</h3>
							<p className="text-sm text-text-secondary">
								Copy this URL to your calendar application (Google Calendar, Outlook, Apple Calendar) to see your events.
							</p>

							{!subscriptionUrl ? (
								<Button
									className="w-full"
									onClick={async () => {
										try {
											const res = await api.post<{ feedUrl: string }>(
												'/calendar/subscriptions',
												{
													name: 'My Events',
													filters: { onlyMine: true }
												}
											)
											setSubscriptionUrl(res.feedUrl)
										} catch (err) {
											handleError(err, 'Failed to create subscription')
										}
									}}>
									Generate Feed URL
								</Button>
							) : (
								<div className="space-y-2">
									<div className="flex gap-2">
										<input
											readOnly
											value={subscriptionUrl}
											className="flex-1 bg-background-secondary border border-border-default rounded px-3 py-2 text-sm font-mono"
											onClick={(e) => e.currentTarget.select()}
										/>
										<Button
											variant="secondary"
											onClick={() => {
												navigator.clipboard.writeText(subscriptionUrl)
												addToast({
													id: 'copy-sub-url',
													message: 'Copied!',
													variant: 'success'
												})
											}}>
											Copy
										</Button>
									</div>
									<p className="text-xs text-text-tertiary">
										Treat this URL like a password. It gives access to your private calendar.
									</p>
								</div>
							)}

							<div className="flex justify-end pt-2">
								<Button variant="ghost" onClick={() => setIsSubscriptionModalOpen(false)}>
									Close
								</Button>
							</div>
						</div>
					</div>
				)
			}

			{/* Event Popup */}
			{
				selectedEvent && (
					<CalendarEventPopup
						event={selectedEvent.event}
						position={selectedEvent.position}
						onClose={() => setSelectedEvent(null)}
						onNavigateToEvent={handleNavigateToEvent}
						onExportICS={handleExportICS}
						onExportGoogle={handleExportGoogle}
					/>
				)
			}
		</div >
	)
}
