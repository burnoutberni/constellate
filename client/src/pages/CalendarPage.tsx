import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

import { Card, Button } from '@/components/ui'
import { useThemeColors } from '@/design-system'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import { api } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import type { Event } from '@/types'

import { CalendarEventPopup } from '../components/CalendarEventPopup'
import { CalendarNavigation } from '../components/CalendarNavigation'
import { CalendarView } from '../components/CalendarView'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { Navbar } from '../components/Navbar'
import { useAuth } from '../hooks/useAuth'
import { useRealtime, type RealtimeEvent } from '../hooks/useRealtime'
import { eventsWithinRange } from '../lib/recurrence'

export function CalendarPage() {
	const colors = useThemeColors()
	const navigate = useNavigate()
	const handleError = useErrorHandler()
	const [events, setEvents] = useState<Event[]>([])
	const [currentDate, setCurrentDate] = useState(new Date())
	const [view, setView] = useState<'month' | 'week' | 'day'>('month')
	const [loading, setLoading] = useState(true)
	const [selectedEvent, setSelectedEvent] = useState<{
		event: Event
		position: { x: number; y: number }
	} | null>(null)
	const [userAttendance, setUserAttendance] = useState<Array<{ eventId: string }>>([])

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

	// Fetch user's attendance data
	useEffect(() => {
		const fetchAttendance = async () => {
			if (!user) {
				return
			}
			try {
				const data = await api.get<{ attendance: string[] }>(
					'/user/attendance',
					undefined,
					undefined,
					'Failed to fetch attendance'
				)
				setUserAttendance(data.attendance.map((eventId) => ({ eventId })))
			} catch (error) {
				logger.error('Error fetching user attendance:', error)
			}
		}
		fetchAttendance()
	}, [user])

	const userAttendingEventIds = useMemo(
		() => new Set(userAttendance.map((a) => a.eventId)),
		[userAttendance]
	)

	// Real-time updates
	const isEventRelevant = useCallback(
		(event: Event) => {
			const eventStartMs = new Date(event.startTime).getTime()
			if (
				!Number.isNaN(eventStartMs) &&
				eventStartMs >= dateRange.startMs &&
				eventStartMs <= dateRange.endMs
			) {
				return true
			}
			if (event.recurrencePattern && event.recurrenceEndDate) {
				const recurrenceEndMs = new Date(event.recurrenceEndDate).getTime()
				return (
					!Number.isNaN(recurrenceEndMs) &&
					!Number.isNaN(eventStartMs) &&
					eventStartMs <= dateRange.endMs &&
					recurrenceEndMs >= dateRange.startMs
				)
			}
			return false
		},
		[dateRange.startMs, dateRange.endMs]
	)

	const handleRealtimeEvent = useCallback(
		(eventMessage: RealtimeEvent) => {
			if (eventMessage.type === 'event:created') {
				const incoming = eventMessage.data.event
				if (!isEventRelevant(incoming)) {
					return
				}
				setEvents((prev) => {
					const exists = prev.some((evt) => evt.id === incoming.id)
					if (exists) {
						return prev.map((evt) => (evt.id === incoming.id ? incoming : evt))
					}
					return [...prev, incoming]
				})
			} else if (eventMessage.type === 'event:updated') {
				const updated = eventMessage.data.event
				setEvents((prev) => {
					const exists = prev.some((evt) => evt.id === updated.id)
					if (!exists) {
						if (!isEventRelevant(updated)) {
							return prev
						}
						return [...prev, updated]
					}
					return prev.map((evt) => (evt.id === updated.id ? updated : evt))
				})
			} else if (eventMessage.type === 'event:deleted') {
				setEvents((prev) => prev.filter((evt) => evt.id !== eventMessage.data.eventId))
			}
		},
		[isEventRelevant]
	)

	const { isConnected } = useRealtime({
		onEvent: handleRealtimeEvent,
	})

	// Fetch events
	useEffect(() => {
		const fetchEvents = async () => {
			try {
				setLoading(true)
				const data = await api.get<{ events: Event[] }>(
					'/events',
					{
						limit: 500,
						rangeStart: dateRange.start.toISOString(),
						rangeEnd: dateRange.end.toISOString(),
					},
					undefined,
					'Failed to fetch events'
				)
				setEvents(data.events)
			} catch (error) {
				logger.error('Error fetching events:', error)
			} finally {
				setLoading(false)
			}
		}

		fetchEvents()
	}, [dateRange.start, dateRange.end, dateRange.startMs, dateRange.endMs, view])

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
									loading={loading}
									userAttendingEventIds={userAttendingEventIds}
									onEventClick={handleEventClick}
								/>
							</Card>
						</ErrorBoundary>
					</div>

					{/* Upcoming Events Sidebar */}
					<div className="space-y-4">
						<Card>
							<h2 className="font-bold text-lg mb-4">Upcoming Events</h2>
							<div className="space-y-3">
								{upcomingEvents.length === 0 ? (
									<p className="text-sm text-text-secondary">
										No upcoming events
									</p>
								) : (
									upcomingEvents.slice(0, 5).map((event) => {
										const isAttending = userAttendingEventIds.has(event.id)
										return (
											<Button
												key={event.id}
												onClick={() => handleNavigateToEvent(event.id)}
												variant="ghost"
												className={`flex gap-3 p-2 rounded hover:bg-background-secondary cursor-pointer w-full justify-start transition-colors ${
													isAttending ? 'ring-1 ring-primary-500' : ''
												}`}>
												<div
													className="w-12 h-12 rounded flex items-center justify-center text-white font-bold flex-shrink-0"
													style={{
														backgroundColor:
															event.user?.displayColor ||
															colors.info[500],
													}}>
													{new Date(event.startTime).getDate()}
												</div>
												<div className="flex-1 min-w-0">
													<div className="font-medium text-sm truncate">
														{event.title}
													</div>
													<div className="text-xs text-text-secondary">
														{new Date(
															event.startTime
														).toLocaleDateString('en-US', {
															month: 'short',
															day: 'numeric',
															hour: 'numeric',
															minute: '2-digit',
														})}
													</div>
													{event.location && (
														<div className="text-xs text-text-secondary mt-1">
															📍 {event.location}
														</div>
													)}
													{event._count && (
														<div className="text-xs text-text-secondary mt-1">
															👥 {event._count.attendance} · ❤️{' '}
															{event._count.likes}
														</div>
													)}
												</div>
											</Button>
										)
									})
								)}
							</div>
						</Card>

						{/* Calendar Export */}
						{user && (
							<Card>
								<h2 className="font-bold text-lg mb-4">Export Calendar</h2>
								<p className="text-sm text-text-secondary mb-4">
									Export your calendar feed to add events to your calendar
									application.
								</p>
								<div className="text-sm">
									<a
										href={`/api/calendar/${user.username}/feed.ics`}
										download
										className="text-primary-600 hover:text-primary-700 underline">
										Download iCal Feed
									</a>
								</div>
							</Card>
						)}
					</div>
				</div>
			</div>

			{/* Event Popup */}
			{selectedEvent && (
				<CalendarEventPopup
					event={selectedEvent.event}
					position={selectedEvent.position}
					onClose={() => setSelectedEvent(null)}
					onNavigateToEvent={handleNavigateToEvent}
					onExportICS={handleExportICS}
					onExportGoogle={handleExportGoogle}
				/>
			)}
		</div>
	)
}
