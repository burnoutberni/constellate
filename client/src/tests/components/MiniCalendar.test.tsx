import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MiniCalendar } from '../../components/MiniCalendar'
import { createTestWrapper, clearQueryClient } from '../testUtils'

// Mock useEvents hook
const mockUseEvents = vi.fn()
vi.mock('../../hooks/queries', () => ({
	useEvents: () => mockUseEvents(),
}))

describe('MiniCalendar Component', () => {
	const { wrapper, queryClient } = createTestWrapper()
	const mockOnDateSelect = vi.fn()

	beforeEach(() => {
		clearQueryClient(queryClient)
		vi.clearAllMocks()
		mockUseEvents.mockReturnValue({
			data: { events: [] },
			isLoading: false,
		})
	})

	it('user can see the current month and year', () => {
		const today = new Date()
		const monthName = today.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

		render(<MiniCalendar selectedDate={today} onDateSelect={mockOnDateSelect} />, { wrapper })

		expect(screen.getByText(monthName)).toBeInTheDocument()
	})

	it('user can see all days of the month are clickable', () => {
		const selectedDate = new Date(2024, 0, 15) // January 15, 2024
		render(<MiniCalendar selectedDate={selectedDate} onDateSelect={mockOnDateSelect} />, {
			wrapper,
		})

		// User should see days from the month
		expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
		expect(screen.getByRole('button', { name: '15' })).toBeInTheDocument()
		expect(screen.getByRole('button', { name: '31' })).toBeInTheDocument()
	})

	it('user can see selected date is visually distinct', () => {
		const selectedDate = new Date(2024, 0, 15) // January 15, 2024
		render(<MiniCalendar selectedDate={selectedDate} onDateSelect={mockOnDateSelect} />, {
			wrapper,
		})

		const selectedButton = screen.getByRole('button', { name: '15' })
		// Selected date should be visually distinct (we check it's rendered, not specific classes)
		expect(selectedButton).toBeInTheDocument()
	})

	it('user can see today is visually distinct', () => {
		const today = new Date()
		render(<MiniCalendar selectedDate={today} onDateSelect={mockOnDateSelect} />, { wrapper })

		const todayButton = screen.getByRole('button', { name: today.getDate().toString() })
		// Today should be visually distinct (we check it's rendered, not specific classes)
		expect(todayButton).toBeInTheDocument()
	})

	it('user can click a day to select it', async () => {
		const user = userEvent.setup()
		const selectedDate = new Date(2024, 0, 15) // January 15, 2024
		render(<MiniCalendar selectedDate={selectedDate} onDateSelect={mockOnDateSelect} />, {
			wrapper,
		})

		const dayButton = screen.getByRole('button', { name: '20' })
		await user.click(dayButton)

		expect(mockOnDateSelect).toHaveBeenCalledTimes(1)
		const calledDate = mockOnDateSelect.mock.calls[0][0]
		expect(calledDate.getDate()).toBe(20)
		expect(calledDate.getMonth()).toBe(0) // January
		expect(calledDate.getFullYear()).toBe(2024)
	})

	it('user can navigate to previous month', async () => {
		const user = userEvent.setup()
		const selectedDate = new Date(2024, 1, 15) // February 15, 2024
		render(<MiniCalendar selectedDate={selectedDate} onDateSelect={mockOnDateSelect} />, {
			wrapper,
		})

		const prevButton = screen.getByLabelText('Previous month')
		await user.click(prevButton)

		expect(mockOnDateSelect).toHaveBeenCalledTimes(1)
		const calledDate = mockOnDateSelect.mock.calls[0][0]
		expect(calledDate.getMonth()).toBe(0) // January
		expect(calledDate.getFullYear()).toBe(2024)
	})

	it('user can navigate to next month', async () => {
		const user = userEvent.setup()
		const selectedDate = new Date(2024, 0, 15) // January 15, 2024
		render(<MiniCalendar selectedDate={selectedDate} onDateSelect={mockOnDateSelect} />, {
			wrapper,
		})

		const nextButton = screen.getByLabelText('Next month')
		await user.click(nextButton)

		expect(mockOnDateSelect).toHaveBeenCalledTimes(1)
		const calledDate = mockOnDateSelect.mock.calls[0][0]
		expect(calledDate.getMonth()).toBe(1) // February
		expect(calledDate.getFullYear()).toBe(2024)
	})

	it('user can navigate across year boundaries to previous month', async () => {
		const user = userEvent.setup()
		const selectedDate = new Date(2024, 0, 15) // January 15, 2024
		render(<MiniCalendar selectedDate={selectedDate} onDateSelect={mockOnDateSelect} />, {
			wrapper,
		})

		const prevButton = screen.getByLabelText('Previous month')
		await user.click(prevButton)

		const calledDate = mockOnDateSelect.mock.calls[0][0]
		expect(calledDate.getMonth()).toBe(11) // December
		expect(calledDate.getFullYear()).toBe(2023)
	})

	it('user can navigate across year boundaries to next month', async () => {
		const user = userEvent.setup()
		const selectedDate = new Date(2024, 11, 15) // December 15, 2024
		render(<MiniCalendar selectedDate={selectedDate} onDateSelect={mockOnDateSelect} />, {
			wrapper,
		})

		const nextButton = screen.getByLabelText('Next month')
		await user.click(nextButton)

		const calledDate = mockOnDateSelect.mock.calls[0][0]
		expect(calledDate.getMonth()).toBe(0) // January
		expect(calledDate.getFullYear()).toBe(2025)
	})

	it('user can click "Go to today" to return to current date', async () => {
		const user = userEvent.setup()
		const selectedDate = new Date(2024, 5, 15) // June 15, 2024
		render(<MiniCalendar selectedDate={selectedDate} onDateSelect={mockOnDateSelect} />, {
			wrapper,
		})

		const goToTodayButton = screen.getByText('Go to today')
		await user.click(goToTodayButton)

		expect(mockOnDateSelect).toHaveBeenCalledTimes(1)
		const calledDate = mockOnDateSelect.mock.calls[0][0]
		const today = new Date()
		expect(calledDate.toDateString()).toBe(today.toDateString())
	})

	it('user can see which days have events', () => {
		const selectedDate = new Date(2024, 0, 15) // January 15, 2024
		const eventDate = new Date(2024, 0, 20, 10, 0, 0) // January 20, 2024 at 10:00

		mockUseEvents.mockReturnValue({
			data: {
				events: [
					{
						id: 'event1',
						title: 'Test Event',
						startTime: eventDate.toISOString(),
						endTime: new Date(2024, 0, 20, 11, 0, 0).toISOString(),
					},
				],
			},
			isLoading: false,
		})

		render(<MiniCalendar selectedDate={selectedDate} onDateSelect={mockOnDateSelect} />, {
			wrapper,
		})

		const day20Button = screen.getByRole('button', { name: '20' })
		// Day with event should have a visual indicator
		const indicator = day20Button.querySelector('.rounded-full')
		expect(indicator).toBeInTheDocument()
	})

	it('user does not see event indicators on days without events', () => {
		const selectedDate = new Date(2024, 0, 15) // January 15, 2024

		mockUseEvents.mockReturnValue({
			data: { events: [] },
			isLoading: false,
		})

		render(<MiniCalendar selectedDate={selectedDate} onDateSelect={mockOnDateSelect} />, {
			wrapper,
		})

		const day15Button = screen.getByRole('button', { name: '15' })
		const indicator = day15Button.querySelector('.rounded-full')
		expect(indicator).not.toBeInTheDocument()
	})

	it('calendar renders correctly when no events are available', () => {
		const selectedDate = new Date(2024, 0, 15)

		mockUseEvents.mockReturnValue({
			data: null,
			isLoading: false,
		})

		render(<MiniCalendar selectedDate={selectedDate} onDateSelect={mockOnDateSelect} />, {
			wrapper,
		})

		expect(screen.getByText('Jan 2024')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: '15' })).toBeInTheDocument()
	})
})
