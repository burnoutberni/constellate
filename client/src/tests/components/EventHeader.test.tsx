import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { type ReactElement } from 'react'
import { EventHeader } from '../../components/EventHeader'

describe('EventHeader', () => {
	const mockOrganizer = {
		id: '1',
		username: 'testuser',
		name: 'Test User',
		profileImage: null,
		displayColor: '#3b82f6',
	}

	const renderWithRouter = (ui: ReactElement) => {
		return render(<BrowserRouter>{ui}</BrowserRouter>)
	}

	it('renders organizer information', () => {
		renderWithRouter(<EventHeader organizers={[mockOrganizer]} />)

		expect(screen.getByText('Test User')).toBeInTheDocument()
		expect(screen.getByText('@testuser')).toBeInTheDocument()
	})

	it('renders event actions when user is owner and eventId is provided', () => {
		const onDelete = vi.fn()
		renderWithRouter(
			<EventHeader
				organizers={[mockOrganizer]}
				eventId="event123"
				isOwner={true}
				onDelete={onDelete}
			/>
		)

		expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
	})

	it('does not render event actions when user is not owner', () => {
		renderWithRouter(
			<EventHeader organizers={[mockOrganizer]} eventId="event123" isOwner={false} />
		)

		expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
	})

	it('does not render event actions when eventId is not provided', () => {
		renderWithRouter(
			<EventHeader organizers={[mockOrganizer]} isOwner={true} onDelete={vi.fn()} />
		)

		expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
	})

	it('renders organizer username as fallback when name is not provided', () => {
		const organizerWithoutName = {
			...mockOrganizer,
			name: null,
		}
		renderWithRouter(<EventHeader organizers={[organizerWithoutName]} />)

		expect(screen.getByText('testuser')).toBeInTheDocument()
	})

	it('links to organizer profile', () => {
		renderWithRouter(<EventHeader organizers={[mockOrganizer]} />)

		const link = screen.getByRole('link')
		expect(link).toHaveAttribute('href', '/@testuser')
	})
})
