import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CalendarView } from '../components/CalendarView'
import type { Event } from '../types'

describe('CalendarView Integration', () => {
	const mockDate = new Date('2025-12-15T12:00:00') // Monday

	const createEvent = (id: string, title: string, startTime: string): Event => ({
		id,
		title,
		startTime,
		timezone: 'UTC',
		tags: [],
		viewerStatus: 'attending',
		_count: { attendance: 1, likes: 0, comments: 0 }
	})

	const events: Event[] = [
		createEvent('1', 'Event 1', '2025-12-15T10:00:00'), // Monday 10am
		createEvent('2', 'Event 2', '2025-12-15T14:00:00'), // Monday 2pm
		createEvent('3', 'Event 3', '2025-12-16T10:00:00'), // Tuesday 10am
	]

	it('renders MonthView correctly', () => {
		render(
			<CalendarView
				view="month"
				currentDate={mockDate}
				events={events}
				loading={false}
			/>
		)

		expect(screen.getByText('Event 1')).toBeDefined()
		expect(screen.getByText('Event 2')).toBeDefined()
		expect(screen.getByText('Event 3')).toBeDefined()
	})

	it('renders WeekView correctly', () => {
		render(
			<CalendarView
				view="week"
				currentDate={mockDate}
				events={events}
				loading={false}
			/>
		)

		expect(screen.getByText('Event 1')).toBeDefined()
		expect(screen.getByText('Event 2')).toBeDefined()
		expect(screen.getByText('Event 3')).toBeDefined()
	})

	it('renders DayView correctly', () => {
		render(
			<CalendarView
				view="day"
				currentDate={mockDate} // Dec 15
				events={events}
				loading={false}
			/>
		)

		expect(screen.getByText('Event 1')).toBeDefined()
		expect(screen.getByText('Event 2')).toBeDefined()
		expect(screen.queryByText('Event 3')).toBeNull()
	})
})
