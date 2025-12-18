import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CalendarView } from '../components/CalendarView'
import type { Event } from '@/types'

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

	it('filters events for specific hour correctly', () => {
		// Use local timezone dates to avoid timezone conversion issues
		const mockEvents = [
			{
				id: '1',
				title: 'Morning Event',
				// Create a date at 10:30 AM in local timezone
				startTime: new Date(2025, 11, 15, 10, 30, 0).toISOString(),
				timezone: 'UTC',
				tags: [],
			},
			{
				id: '2',
				title: 'Afternoon Event',
				// Create a date at 2:30 PM in local timezone
				startTime: new Date(2025, 11, 15, 14, 30, 0).toISOString(),
				timezone: 'UTC',
				tags: [],
			},
		]

		const hour = 10

		const filtered = mockEvents.filter((event) => {
			const eventDate = new Date(event.startTime)
			// Compare in local timezone
			const eventLocalHour = eventDate.getHours()
			return eventLocalHour === hour
		})

		expect(filtered.length).toBe(1)
		expect(filtered[0].title).toBe('Morning Event')
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

describe('CalendarView Rendering', () => {
	const mockEvent: Event = {
		id: '1',
		title: 'Test Event',
		startTime: new Date('2025-12-15T10:00:00').toISOString(),
		endTime: new Date('2025-12-15T11:00:00').toISOString(),
		timezone: 'UTC',
		tags: [],
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		creatorId: 'user1',
		instanceId: 'instance1',
		slug: 'test-event',
	}

	it('renders events in Month view', () => {
		const date = new Date('2025-12-15T12:00:00')
		render(
			<CalendarView view="month" currentDate={date} events={[mockEvent]} loading={false} />
		)
		expect(screen.getByText('Test Event')).toBeInTheDocument()
	})

	it('renders events in Week view', () => {
		const date = new Date('2025-12-15T12:00:00')
		render(<CalendarView view="week" currentDate={date} events={[mockEvent]} loading={false} />)
		expect(screen.getByText('Test Event')).toBeInTheDocument()
	})

	it('renders events in Day view', () => {
		const date = new Date('2025-12-15T12:00:00')
		render(<CalendarView view="day" currentDate={date} events={[mockEvent]} loading={false} />)
		expect(screen.getByText('Test Event')).toBeInTheDocument()
	})
})
