import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { type ReactElement } from 'react'
import { EventActions } from '../../components/EventActions'

describe('EventActions', () => {
  const renderWithRouter = (ui: ReactElement) => {
    return render(<BrowserRouter>{ui}</BrowserRouter>)
  }

  it('renders edit, duplicate, and delete buttons when user is owner', () => {
    const onDelete = vi.fn()
    const onDuplicate = vi.fn()
    
    renderWithRouter(
      <EventActions
        username="testuser"
        eventId="event123"
        isOwner={true}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
      />
    )

    expect(screen.getByRole('link', { name: /edit/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /duplicate/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
  })

  it('does not render buttons when user is not owner', () => {
    renderWithRouter(
      <EventActions
        username="testuser"
        eventId="event123"
        isOwner={false}
      />
    )

    expect(screen.queryByRole('link', { name: /edit/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /duplicate/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
  })

  it('edit link points to correct URL', () => {
    renderWithRouter(
      <EventActions
        username="testuser"
        eventId="event123"
        isOwner={true}
        onDelete={vi.fn()}
      />
    )

    const editLink = screen.getByRole('link', { name: /edit/i })
    expect(editLink).toHaveAttribute('href', '/edit/@testuser/event123')
  })

  it('does not render duplicate button when callback is not provided', () => {
    renderWithRouter(
      <EventActions
        username="testuser"
        eventId="event123"
        isOwner={true}
        onDelete={vi.fn()}
      />
    )

    expect(screen.queryByRole('button', { name: /duplicate/i })).not.toBeInTheDocument()
  })

  it('disables delete button when deleting', () => {
    renderWithRouter(
      <EventActions
        username="testuser"
        eventId="event123"
        isOwner={true}
        onDelete={vi.fn()}
        isDeleting={true}
      />
    )

    const deleteButton = screen.getByRole('button', { name: /delete/i })
    expect(deleteButton).toBeDisabled()
  })

  it('disables duplicate button when duplicating', () => {
    renderWithRouter(
      <EventActions
        username="testuser"
        eventId="event123"
        isOwner={true}
        onDuplicate={vi.fn()}
        isDuplicating={true}
      />
    )

    const duplicateButton = screen.getByRole('button', { name: /duplicate/i })
    expect(duplicateButton).toBeDisabled()
  })
})
