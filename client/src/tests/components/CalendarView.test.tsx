import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { CalendarView } from '../../components/CalendarView'
import type { Event } from '../../types'

// Mock SafeHTML component since it might cause issues or is just UI
vi.mock('../../components/ui', async () => {
    const actual = await vi.importActual('../../components/ui')
    return {
        ...actual,
        // eslint-disable-next-line react/no-danger
        SafeHTML: ({ html }: { html: string }) => <div dangerouslySetInnerHTML={{ __html: html }} />,
    }
})

describe('CalendarView Accessibility', () => {
	const mockDate = new Date('2025-12-15T12:00:00.000Z') // A Monday
	const mockEvents: Event[] = [
		{
			id: '1',
			title: 'Team Meeting',
			startTime: '2025-12-15T10:00:00.000Z',
			endTime: '2025-12-15T11:00:00.000Z',
			timezone: 'UTC',
			location: 'Room A',
			viewerStatus: 'attending',
			tags: [],
		},
		{
			id: '2',
			title: 'Lunch',
			startTime: '2025-12-15T12:00:00.000Z',
			timezone: 'UTC',
			viewerStatus: 'maybe',
			tags: [],
		},
        {
			id: '3',
			title: 'Focus Time',
			startTime: '2025-12-15T14:00:00.000Z',
			timezone: 'UTC',
			tags: [],
		},
	]

	it('renders month view events with accessible labels', () => {
		render(
			<CalendarView
				view="month"
				currentDate={mockDate}
				events={mockEvents}
				loading={false}
			/>
		)

		// Check for aria-label on the button using regex to match parts
		const teamMeeting = screen.getByLabelText(/Team Meeting.*Room A.*Status: Attending/i)
		expect(teamMeeting).toBeInTheDocument()

		const lunch = screen.getByLabelText(/Lunch.*Status: Maybe/i)
		expect(lunch).toBeInTheDocument()

        const focusTime = screen.getByLabelText(/Focus Time/i)
        expect(focusTime).toBeInTheDocument()
	})

	it('renders week view events with accessible labels', () => {
		render(
			<CalendarView
				view="week"
				currentDate={mockDate}
				events={mockEvents}
				loading={false}
			/>
		)

		const teamMeeting = screen.getByLabelText(/Team Meeting.*Room A.*Status: Attending/i)
		expect(teamMeeting).toBeInTheDocument()
	})

	it('renders day view events with accessible labels', () => {
		render(
			<CalendarView
				view="day"
				currentDate={mockDate}
				events={mockEvents}
				loading={false}
			/>
		)

		const teamMeeting = screen.getByLabelText(/Team Meeting.*Room A.*Status: Attending/i)
		expect(teamMeeting).toBeInTheDocument()
	})
})
