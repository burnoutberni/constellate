import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { EventHeader } from './EventHeader'

describe('EventHeader', () => {
  const mockOrganizer = {
    id: '1',
    username: 'testuser',
    name: 'Test User',
    profileImage: null,
    displayColor: '#3b82f6',
  }

  const renderWithRouter = (ui: React.ReactElement) => {
    return render(<BrowserRouter>{ui}</BrowserRouter>)
  }

  it('renders organizer information', () => {
    renderWithRouter(<EventHeader organizer={mockOrganizer} />)

    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('@testuser')).toBeInTheDocument()
  })

  it('renders delete button when user is owner', () => {
    const onDelete = vi.fn()
    renderWithRouter(
      <EventHeader
        organizer={mockOrganizer}
        isOwner={true}
        onDelete={onDelete}
      />
    )

    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
  })

  it('does not render delete button when user is not owner', () => {
    renderWithRouter(<EventHeader organizer={mockOrganizer} isOwner={false} />)

    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
  })

  it('renders organizer username as fallback when name is not provided', () => {
    const organizerWithoutName = {
      ...mockOrganizer,
      name: null,
    }
    renderWithRouter(<EventHeader organizer={organizerWithoutName} />)

    expect(screen.getByText('testuser')).toBeInTheDocument()
  })

  it('links to organizer profile', () => {
    renderWithRouter(<EventHeader organizer={mockOrganizer} />)

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/@testuser')
  })
})
