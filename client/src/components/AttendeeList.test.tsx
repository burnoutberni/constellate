import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AttendeeList } from './AttendeeList'
import type { Attendee } from './AttendeeList'

const mockAttendees: Attendee[] = [
    {
        user: {
            id: '1',
            username: 'user1',
            name: 'User One',
            profileImage: null,
            displayColor: null,
        },
        status: 'attending',
    },
    {
        user: {
            id: '2',
            username: 'user2',
            name: 'User Two',
            profileImage: null,
            displayColor: null,
        },
        status: 'attending',
    },
    {
        user: {
            id: '3',
            username: 'user3',
            name: 'User Three',
            profileImage: null,
            displayColor: null,
        },
        status: 'maybe',
    },
]

const renderWithRouter = (ui: React.ReactElement) => {
    return render(<BrowserRouter>{ui}</BrowserRouter>)
}

describe('AttendeeList', () => {
    it('renders null when no attendees', () => {
        const { container } = renderWithRouter(<AttendeeList attendees={[]} />)
        expect(container.firstChild).toBeNull()
    })

    it('renders attendee count with correct numbers', () => {
        renderWithRouter(<AttendeeList attendees={mockAttendees} />)

        expect(screen.getByText(/Attendees \(2 going, 1 maybe\)/)).toBeInTheDocument()
    })

    it('renders going section with attendees', () => {
        renderWithRouter(<AttendeeList attendees={mockAttendees} />)

        expect(screen.getByText('Going')).toBeInTheDocument()
        expect(screen.getByText('User One')).toBeInTheDocument()
        expect(screen.getByText('User Two')).toBeInTheDocument()
    })

    it('renders maybe section with attendees', () => {
        renderWithRouter(<AttendeeList attendees={mockAttendees} />)

        expect(screen.getByText('Maybe')).toBeInTheDocument()
        expect(screen.getByText('User Three')).toBeInTheDocument()
    })

    it('shows correct number of attendees initially', () => {
        const manyAttendees: Attendee[] = Array.from({ length: 15 }, (_, i) => ({
            user: {
                id: `user${i}`,
                username: `user${i}`,
                name: `User ${i}`,
                profileImage: null,
                displayColor: null,
            },
            status: 'attending',
        }))

        renderWithRouter(<AttendeeList attendees={manyAttendees} initialDisplayCount={10} />)

        expect(screen.getByText('+5 more')).toBeInTheDocument()
    })

    it('shows all attendees when show more is clicked', () => {
        const manyAttendees: Attendee[] = Array.from({ length: 15 }, (_, i) => ({
            user: {
                id: `user${i}`,
                username: `user${i}`,
                name: `User ${i}`,
                profileImage: null,
                displayColor: null,
            },
            status: 'attending',
        }))

        renderWithRouter(<AttendeeList attendees={manyAttendees} initialDisplayCount={10} />)

        const showMoreButton = screen.getByText('+5 more')
        fireEvent.click(showMoreButton)

        expect(screen.getByText('Show less')).toBeInTheDocument()
        expect(screen.queryByText('+5 more')).not.toBeInTheDocument()
    })

    it('hides extra attendees when show less is clicked', () => {
        const manyAttendees: Attendee[] = Array.from({ length: 15 }, (_, i) => ({
            user: {
                id: `user${i}`,
                username: `user${i}`,
                name: `User ${i}`,
                profileImage: null,
                displayColor: null,
            },
            status: 'attending',
        }))

        renderWithRouter(<AttendeeList attendees={manyAttendees} initialDisplayCount={10} />)

        const showMoreButton = screen.getByText('+5 more')
        fireEvent.click(showMoreButton)

        const showLessButton = screen.getByText('Show less')
        fireEvent.click(showLessButton)

        expect(screen.getByText('+5 more')).toBeInTheDocument()
        expect(screen.queryByText('Show less')).not.toBeInTheDocument()
    })

    it('renders with badge view when showAvatars is false', () => {
        renderWithRouter(<AttendeeList attendees={mockAttendees} showAvatars={false} />)

        expect(screen.queryByText('Going')).not.toBeInTheDocument()
        expect(screen.queryByText('Maybe')).not.toBeInTheDocument()
    })

    it('creates links to user profiles', () => {
        renderWithRouter(<AttendeeList attendees={mockAttendees} />)

        const link = screen.getByText('User One').closest('a')
        expect(link).toHaveAttribute('href', '/@user1')
    })
})
