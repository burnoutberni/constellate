import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { describe, it, expect, vi } from 'vitest'

import { CalendarView } from '../../components/CalendarView'
import type { Event } from '../../types'

// Mock the SafeHTML component as it can be complex
vi.mock('../../components/ui', () => ({
	Button: ({ children, ...props }: React.ComponentProps<'button'>) => (
		<button {...props}>{children}</button>
	),
	Spinner: () => <div>Loading...</div>,
	SafeHTML: ({ html }: { html: string }) => <div data-testid="safe-html">{html}</div>,
}))

const mockEvent: Event = {
	id: '1',
	title: 'Test Event',
	startTime: new Date().toISOString(),
	endTime: new Date(Date.now() + 3600000).toISOString(),
	timezone: 'UTC',
	tags: [],
	user: {
		id: 'u1',
		username: 'user1',
		isRemote: false,
	},
	_count: {
		attendance: 0,
		likes: 0,
		comments: 0,
	},
	viewerStatus: 'attending',
}

describe('CalendarView', () => {
	const currentDate = new Date()

	it('renders MonthView correctly', () => {
		render(
			<CalendarView
				view="month"
				currentDate={currentDate}
				events={[mockEvent]}
				loading={false}
			/>
		)

		expect(screen.getByText('Test Event')).toBeInTheDocument()
		// Check for day headers
		expect(screen.getByText('Mon')).toBeInTheDocument()
	})

	it('renders WeekView correctly', () => {
		// Ensure the event is within the visible hours (7 AM - 7 PM)
		const eventDate = new Date()
		eventDate.setHours(10, 0, 0, 0)
		const weekEvent = {
			...mockEvent,
			startTime: eventDate.toISOString(),
			endTime: new Date(eventDate.getTime() + 3600000).toISOString(),
		}

		render(
			<CalendarView
				view="week"
				currentDate={eventDate}
				events={[weekEvent]}
				loading={false}
			/>
		)

		expect(screen.getByText(/Test Event/)).toBeInTheDocument()
		// Check for time labels
		expect(screen.getByText('10 AM')).toBeInTheDocument()
	})

	it('renders DayView correctly', () => {
		// Ensure the event is within the visible hours (7 AM - 7 PM)
		const eventDate = new Date()
		eventDate.setHours(14, 0, 0, 0) // 2 PM
		const dayEvent = {
			...mockEvent,
			startTime: eventDate.toISOString(),
			endTime: new Date(eventDate.getTime() + 3600000).toISOString(),
		}

		render(
			<CalendarView
				view="day"
				currentDate={eventDate}
				events={[dayEvent]}
				loading={false}
			/>
		)

		expect(screen.getByText('Test Event')).toBeInTheDocument()
		// Check for time labels
		expect(screen.getByText('2 PM')).toBeInTheDocument()
	})

	it('handles event click', () => {
		const onEventClick = vi.fn()
		render(
			<CalendarView
				view="month"
				currentDate={currentDate}
				events={[mockEvent]}
				loading={false}
				onEventClick={onEventClick}
			/>
		)

		fireEvent.click(screen.getByText('Test Event'))
		expect(onEventClick).toHaveBeenCalledWith(mockEvent, expect.anything())
	})

	it('shows loading state', () => {
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
