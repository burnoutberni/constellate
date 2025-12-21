/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReminderItemWithDelete } from '../../components/ReminderItemWithDelete'
import { createTestWrapper } from '../testUtils'

// Mock the hook
const mockMutate = vi.fn()
vi.mock('@/hooks/queries', () => ({
	useDeleteReminder: () => ({
		mutate: mockMutate,
		isPending: false,
	}),
}))

// Mock ReminderItem to avoid rendering complexity
vi.mock('../../components/ReminderItem', () => ({
	ReminderItem: ({ onDelete, isDeleting }: any) => (
		<div data-testid="reminder-item">
			<button
				data-testid="delete-button"
				onClick={() => onDelete('reminder-1')}
				disabled={isDeleting}>
				Delete Item
			</button>
		</div>
	),
}))

// We use the real ConfirmationModal. It renders into document.body or similar (no portal).
// So checking screen.getByText should work.

describe('ReminderItemWithDelete Component', () => {
	const { wrapper } = createTestWrapper()

	const mockReminder = {
		id: 'reminder-1',
		event: {
			id: 'event-1',
			title: 'Test Event',
			startTime: '2023-01-01T12:00:00Z',
			timezone: 'UTC',
			user: {
				username: 'testuser',
				name: 'Test User',
			},
		},
		remindAt: '2023-01-01T11:00:00Z',
		minutesBeforeStart: 60,
		status: 'PENDING',
	} as any

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('shows confirmation modal when delete is clicked and does not delete immediately', () => {
		render(<ReminderItemWithDelete reminder={mockReminder} />, { wrapper })

		const deleteButton = screen.getByTestId('delete-button')
		fireEvent.click(deleteButton)

		// Expect modal title
		expect(screen.getByText('Delete Reminder')).toBeInTheDocument()
		expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument()

		// Expect mutate NOT to be called yet
		expect(mockMutate).not.toHaveBeenCalled()
	})

	it('calls delete mutation when confirmed', () => {
		render(<ReminderItemWithDelete reminder={mockReminder} />, { wrapper })

		// Open modal
		fireEvent.click(screen.getByTestId('delete-button'))

		// Find the confirm button in the modal.
		// Since "Delete Item" is the trigger, and we'll label the confirm button "Delete",
		// we can look for button with name "Delete".
		const confirmButton = screen.getByRole('button', { name: 'Delete' })
		fireEvent.click(confirmButton)

		expect(mockMutate).toHaveBeenCalledWith('reminder-1', expect.anything())
	})

	it('closes modal when cancelled', () => {
		render(<ReminderItemWithDelete reminder={mockReminder} />, { wrapper })

		// Open modal
		fireEvent.click(screen.getByTestId('delete-button'))

		// Find cancel button
		const cancelButton = screen.getByRole('button', { name: 'Cancel' })
		fireEvent.click(cancelButton)

		// Modal should be gone
		expect(screen.queryByText('Delete Reminder')).not.toBeInTheDocument()
		expect(mockMutate).not.toHaveBeenCalled()
	})
})
