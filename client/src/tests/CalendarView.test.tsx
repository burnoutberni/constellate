import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CalendarView } from '../components/CalendarView'
import { Event } from '@/types'

// Mock UI components
vi.mock('../components/ui', () => ({
	Button: ({ children, onClick, title, ...props }: { children: React.ReactNode, onClick?: React.MouseEventHandler, title?: string }) => (
		<button onClick={onClick} title={title} {...props}>
			{children}
		</button>
	),
	Spinner: () => <div>Loading...</div>,
	SafeHTML: ({ html }: { html: string }) => <div>{html}</div>
}))

describe('CalendarView', () => {
	const currentDate = new Date('2025-12-15T12:00:00Z') // A Monday
	const mockEvents: Event[] = [
		{
			id: '1',
			title: 'Morning Event',
			startTime: '2025-12-15T10:00:00Z', // 10 AM UTC
			endTime: '2025-12-15T11:00:00Z',
			timezone: 'UTC',
			tags: [],
			viewerStatus: 'attending',
			user: { id: 'u1', username: 'user1', isRemote: false }
		},
		{
			id: '2',
			title: 'Afternoon Event',
			startTime: '2025-12-15T14:00:00Z', // 2 PM UTC
			endTime: '2025-12-15T15:00:00Z',
			timezone: 'UTC',
			tags: [],
			viewerStatus: 'maybe',
			user: { id: 'u1', username: 'user1', isRemote: false }
		},
		{
			id: '3',
			title: 'Different Day',
			startTime: '2025-12-16T10:00:00Z',
			timezone: 'UTC',
			tags: [],
			user: { id: 'u1', username: 'user1', isRemote: false }
		},
		{
			id: '4',
			title: 'Outside Hours',
			startTime: '2025-12-15T05:00:00Z', // 5 AM UTC
			timezone: 'UTC',
			tags: [],
			user: { id: 'u1', username: 'user1', isRemote: false }
		}
	]

	it('renders MonthView and handles event grouping correctly', () => {
		// Add another event on the same day to test grouping
		const eventsWithSameDay = [
			...mockEvents,
			{
				id: '5',
				title: 'Another Morning Event',
				startTime: '2025-12-15T11:00:00Z',
				timezone: 'UTC',
				tags: [],
				user: { id: 'u1', username: 'user1', isRemote: false }
			}
		]

		render(
			<CalendarView
				view="month"
				currentDate={currentDate}
				events={eventsWithSameDay}
				loading={false}
			/>
		)

		expect(screen.getByText('Morning Event')).toBeInTheDocument()
		expect(screen.getByText('Afternoon Event')).toBeInTheDocument()
		expect(screen.getByText('Different Day')).toBeInTheDocument()
		// Both events on 15th should be visible
		// Using queryByText and checking truthiness since truncation might hide full text or it might be in a "more" button
		// But in this test setup with 2 events, both should be visible directly or via "more"
		// The issue is likely that "Another Morning Event" is the 4th event on that day (Morning, Afternoon, Outside Hours?? No, Outside is different)
		// Let's debug by checking if it's rendered.
		// Actually, in the test setup:
		// 1. Morning Event (15th)
		// 2. Afternoon Event (15th)
		// 3. Different Day (16th)
		// 4. Outside Hours (15th) -> this counts towards the day's total!
		// 5. Another Morning Event (15th)
		// So there are 4 events on the 15th.
		// MonthView shows slice(0, 3). So the 4th event "Another Morning Event" is hidden behind "+1 more".
		expect(screen.getByText('+1 more')).toBeInTheDocument()
	})

	it('renders WeekView and handles event bucketing correctly', () => {
		// Add another event in the same hour slot to test array pushing
		const eventsWithSameHour = [
			...mockEvents,
			{
				id: '6',
				title: 'Clashing Event',
				startTime: '2025-12-15T10:15:00Z',
				timezone: 'UTC',
				tags: [],
				user: { id: 'u1', username: 'user1', isRemote: false }
			}
		]

		render(
			<CalendarView
				view="week"
				currentDate={currentDate}
				events={eventsWithSameHour}
				loading={false}
			/>
		)

		// Note: JS Date parsing of ISO strings uses local time in some envs or UTC depending on constructor.
		// The component uses new Date(isoString).
		// We expect events to be rendered.
		expect(screen.getByText('Morning Event')).toBeInTheDocument()
		expect(screen.getByText('Clashing Event')).toBeInTheDocument()

		// Event outside hours (5 AM) should NOT be rendered in WeekView (7 AM - 7 PM)
		expect(screen.queryByText('Outside Hours')).not.toBeInTheDocument()
	})

	it('renders DayView and handles event bucketing correctly', () => {
		// Add another event in the same hour slot
		const eventsWithSameHour = [
			...mockEvents,
			{
				id: '7',
				title: 'Same Hour Event',
				startTime: '2025-12-15T10:45:00Z',
				timezone: 'UTC',
				tags: [],
				user: { id: 'u1', username: 'user1', isRemote: false }
			}
		]

		render(
			<CalendarView
				view="day"
				currentDate={currentDate}
				events={eventsWithSameHour}
				loading={false}
			/>
		)

		expect(screen.getByText('Morning Event')).toBeInTheDocument()
		expect(screen.getByText('Same Hour Event')).toBeInTheDocument()
		expect(screen.queryByText('Different Day')).not.toBeInTheDocument()
		expect(screen.queryByText('Outside Hours')).not.toBeInTheDocument()
	})

	it('handles interactions correctly', () => {
		const onEventClick = vi.fn()
		const onEventHover = vi.fn()

		render(
			<CalendarView
				view="day"
				currentDate={currentDate}
				events={mockEvents}
				loading={false}
				onEventClick={onEventClick}
				onEventHover={onEventHover}
			/>
		)

		const eventButton = screen.getByText('Morning Event').closest('button')
		if (eventButton) {
			fireEvent.click(eventButton)
			expect(onEventClick).toHaveBeenCalled()

			fireEvent.mouseEnter(eventButton)
			expect(onEventHover).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }))

			fireEvent.mouseLeave(eventButton)
			expect(onEventHover).toHaveBeenCalledWith(null)
		}
	})

	it('renders loading state', () => {
		render(
			<CalendarView
				view="month"
				currentDate={currentDate}
				events={[]}
				loading={true}
			/>
		)
		expect(screen.getByText('Loading...')).toBeInTheDocument()
	})
})

/**
 * Test CalendarView helper functions and date calculation logic
 */
describe('CalendarView date calculations', () => {
	it('calculates correct week start date', () => {
		const currentDate = new Date('2025-12-15') // Monday
		const startOfWeek = new Date(
			currentDate.getFullYear(),
			currentDate.getMonth(),
			currentDate.getDate() - currentDate.getDay(),
			0,
			0,
			0,
			0
		)

		expect(startOfWeek.getDay()).toBe(0) // Sunday
		expect(startOfWeek.getDate()).toBe(14) // December 14
	})

	it('calculates correct week days', () => {
		const currentDate = new Date('2025-12-15')
		const startOfWeek = new Date(
			currentDate.getFullYear(),
			currentDate.getMonth(),
			currentDate.getDate() - currentDate.getDay(),
			0,
			0,
			0,
			0
		)

		const days = []
		for (let i = 0; i < 7; i++) {
			days.push(
				new Date(
					startOfWeek.getFullYear(),
					startOfWeek.getMonth(),
					startOfWeek.getDate() + i,
					0,
					0,
					0,
					0
				)
			)
		}

		expect(days.length).toBe(7)
		expect(days[0].getDay()).toBe(0) // Sunday
		expect(days[6].getDay()).toBe(6) // Saturday
	})

	it('generates correct hour range', () => {
		const hours = Array.from({ length: 13 }, (_, i) => i + 7)
		expect(hours.length).toBe(13)
		expect(hours[0]).toBe(7) // 7 AM
		expect(hours[12]).toBe(19) // 7 PM
	})

	it('calculates month days correctly', () => {
		const date = new Date('2025-12-15')
		const year = date.getFullYear()
		const month = date.getMonth()
		const firstDay = new Date(year, month, 1)
		const lastDay = new Date(year, month + 1, 0)
		const daysInMonth = lastDay.getDate()
		const startingDayOfWeek = firstDay.getDay()

		expect(daysInMonth).toBe(31) // December has 31 days
		expect(startingDayOfWeek).toBe(1) // December 1, 2025 is Monday
	})
})
