import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CalendarView } from '../../components/CalendarView'
import { createTestWrapper, clearQueryClient } from '../testUtils'
import { Event } from '../../types'

const createEvent = (id: string, title: string, startTime: Date, endTime: Date): Event => ({
	id,
	title,
	startTime: startTime.toISOString(),
	endTime: endTime.toISOString(),
	isRemote: false,
	location: 'Test Location',
	isPrivate: false,
	viewerStatus: 'attending',
	User: {
		id: 'user1',
		username: 'testuser',
		displayName: 'Test User',
		avatar: null,
	},
	_count: {
		likes: 0,
		comments: 0,
		shares: 0,
		rsvps: 1,
	},
})

describe('CalendarView Component', () => {
	const { wrapper, queryClient } = createTestWrapper()
	const mockOnEventClick = vi.fn()
	const mockOnEventHover = vi.fn()

	// Monday, Jan 15 2024
	const currentDate = new Date(2024, 0, 15, 10, 0, 0)

	beforeEach(() => {
		clearQueryClient(queryClient)
		vi.clearAllMocks()
	})

	describe('MonthView', () => {
		it('renders events on the correct day', () => {
			const eventDate = new Date(2024, 0, 15, 14, 0, 0) // Jan 15 2024, 2 PM
			const events = [
				createEvent('1', 'Test Event 1', eventDate, new Date(eventDate.getTime() + 3600000)),
			]

			render(
				<CalendarView
					view="month"
					currentDate={currentDate}
					events={events}
					loading={false}
					onEventClick={mockOnEventClick}
					onEventHover={mockOnEventHover}
				/>,
				{ wrapper }
			)

			// Should show the day
			expect(screen.getByText('15')).toBeInTheDocument()
			// Should show the event
			expect(screen.getByText('Test Event 1')).toBeInTheDocument()
		})

		it('renders multiple events on the same day', () => {
			const eventDate1 = new Date(2024, 0, 15, 10, 0, 0)
			const eventDate2 = new Date(2024, 0, 15, 14, 0, 0)
			const events = [
				createEvent('1', 'Morning Event', eventDate1, new Date(eventDate1.getTime() + 3600000)),
				createEvent('2', 'Afternoon Event', eventDate2, new Date(eventDate2.getTime() + 3600000)),
			]

			render(
				<CalendarView
					view="month"
					currentDate={currentDate}
					events={events}
					loading={false}
					onEventClick={mockOnEventClick}
					onEventHover={mockOnEventHover}
				/>,
				{ wrapper }
			)

			expect(screen.getByText('Morning Event')).toBeInTheDocument()
			expect(screen.getByText('Afternoon Event')).toBeInTheDocument()
		})

        it('does not render events from other months', () => {
            const nextMonthDate = new Date(2024, 1, 15, 10, 0, 0)
			const events = [
				createEvent('1', 'Next Month Event', nextMonthDate, new Date(nextMonthDate.getTime() + 3600000)),
			]

			render(
				<CalendarView
					view="month"
					currentDate={currentDate} // Jan 2024
					events={events}
					loading={false}
					onEventClick={mockOnEventClick}
					onEventHover={mockOnEventHover}
				/>,
				{ wrapper }
			)

			expect(screen.queryByText('Next Month Event')).not.toBeInTheDocument()
        })
	})

	describe('WeekView', () => {
		it('renders events in the correct time slot', () => {
			// Monday is the 15th
			const eventDate = new Date(2024, 0, 15, 10, 30, 0) // Monday 10:30 AM
			const events = [
				createEvent('1', 'Weekly Meeting', eventDate, new Date(eventDate.getTime() + 3600000)),
			]

			render(
				<CalendarView
					view="week"
					currentDate={currentDate}
					events={events}
					loading={false}
					onEventClick={mockOnEventClick}
					onEventHover={mockOnEventHover}
				/>,
				{ wrapper }
			)

			// Should show day header (Monday 15)
			expect(screen.getByText('15')).toBeInTheDocument()
			expect(screen.getByText('Mon')).toBeInTheDocument()

			// Should show event
			expect(screen.getByText('Weekly Meeting')).toBeInTheDocument()

            // Verify it's in the 10 AM row (roughly)
            // Since structure is complex, we rely on presence for now.
            // Better check: The event button is rendered within a container that corresponds to the day/hour.
            // But strict visual placement is hard to test in JSDOM without layout engine.
            // We can check if it appears at all.
		})

        it('renders multiple events in different slots', () => {
			const monday10am = new Date(2024, 0, 15, 10, 0, 0)
            const tuesday2pm = new Date(2024, 0, 16, 14, 0, 0)
			const events = [
				createEvent('1', 'Monday Morning', monday10am, new Date(monday10am.getTime() + 3600000)),
                createEvent('2', 'Tuesday Afternoon', tuesday2pm, new Date(tuesday2pm.getTime() + 3600000)),
			]

			render(
				<CalendarView
					view="week"
					currentDate={currentDate}
					events={events}
					loading={false}
					onEventClick={mockOnEventClick}
					onEventHover={mockOnEventHover}
				/>,
				{ wrapper }
			)

			expect(screen.getByText('Monday Morning')).toBeInTheDocument()
            expect(screen.getByText('Tuesday Afternoon')).toBeInTheDocument()
		})

        it('does not render events outside visible hours (7am - 7pm)', () => {
            const earlyEvent = new Date(2024, 0, 15, 5, 0, 0) // 5 AM
            const lateEvent = new Date(2024, 0, 15, 21, 0, 0) // 9 PM
			const events = [
				createEvent('1', 'Early Bird', earlyEvent, new Date(earlyEvent.getTime() + 3600000)),
                createEvent('2', 'Night Owl', lateEvent, new Date(lateEvent.getTime() + 3600000)),
			]

			render(
				<CalendarView
					view="week"
					currentDate={currentDate}
					events={events}
					loading={false}
					onEventClick={mockOnEventClick}
					onEventHover={mockOnEventHover}
				/>,
				{ wrapper }
			)

			expect(screen.queryByText('Early Bird')).not.toBeInTheDocument()
            expect(screen.queryByText('Night Owl')).not.toBeInTheDocument()
        })
	})

	describe('DayView', () => {
		it('renders events in the correct time slot', () => {
			const eventDate = new Date(2024, 0, 15, 14, 0, 0) // 2 PM
			const events = [
				createEvent('1', 'Daily Standup', eventDate, new Date(eventDate.getTime() + 3600000)),
			]

			render(
				<CalendarView
					view="day"
					currentDate={currentDate}
					events={events}
					loading={false}
					onEventClick={mockOnEventClick}
					onEventHover={mockOnEventHover}
				/>,
				{ wrapper }
			)

			expect(screen.getByText('Daily Standup')).toBeInTheDocument()
		})

        it('does not render events from other days', () => {
            const tomorrowEvent = new Date(2024, 0, 16, 14, 0, 0)
            const events = [
				createEvent('1', 'Tomorrow Event', tomorrowEvent, new Date(tomorrowEvent.getTime() + 3600000)),
			]

            render(
				<CalendarView
					view="day"
					currentDate={currentDate}
					events={events}
					loading={false}
					onEventClick={mockOnEventClick}
					onEventHover={mockOnEventHover}
				/>,
				{ wrapper }
			)

            expect(screen.queryByText('Tomorrow Event')).not.toBeInTheDocument()
        })
	})
})
