import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal } from '../../components/ui/Modal'
import { createTestWrapper } from '../testUtils'
import React, { useState } from 'react'

describe('Modal Component', () => {
	const { wrapper } = createTestWrapper()
	const mockOnClose = vi.fn()

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('user cannot see modal when it is closed', () => {
		render(
			<Modal isOpen={false} onClose={mockOnClose}>
				<div>Modal Content</div>
			</Modal>,
			{ wrapper }
		)

		expect(screen.queryByText('Modal Content')).not.toBeInTheDocument()
	})

	it('user can see modal content when it is open', () => {
		render(
			<Modal isOpen={true} onClose={mockOnClose}>
				<div>Modal Content</div>
			</Modal>,
			{ wrapper }
		)

		expect(screen.getByText('Modal Content')).toBeInTheDocument()
		expect(screen.getByRole('dialog')).toBeInTheDocument()
		expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
	})

	it('user can close modal by clicking backdrop', () => {
		render(
			<Modal isOpen={true} onClose={mockOnClose}>
				<div>Modal Content</div>
			</Modal>,
			{ wrapper }
		)

		const backdrop = screen.getByRole('dialog')
		fireEvent.click(backdrop)

		expect(mockOnClose).toHaveBeenCalledTimes(1)
	})

	it('user cannot close modal by clicking content', () => {
		render(
			<Modal isOpen={true} onClose={mockOnClose}>
				<div>Modal Content</div>
			</Modal>,
			{ wrapper }
		)

		const content = screen.getByText('Modal Content')
		fireEvent.click(content)

		expect(mockOnClose).not.toHaveBeenCalled()
	})

	it('user can close modal by pressing Escape key', async () => {
		const user = userEvent.setup()
		render(
			<Modal isOpen={true} onClose={mockOnClose}>
				<div>Modal Content</div>
			</Modal>,
			{ wrapper }
		)

		await user.keyboard('{Escape}')

		expect(mockOnClose).toHaveBeenCalledTimes(1)
	})

	it('user cannot close modal with Escape when closeOnEscape is disabled', async () => {
		const user = userEvent.setup()
		render(
			<Modal isOpen={true} onClose={mockOnClose} closeOnEscape={false}>
				<div>Modal Content</div>
			</Modal>,
			{ wrapper }
		)

		await user.keyboard('{Escape}')

		expect(mockOnClose).not.toHaveBeenCalled()
	})

	it('user cannot close modal by clicking backdrop when closeOnBackdropClick is disabled', () => {
		render(
			<Modal isOpen={true} onClose={mockOnClose} closeOnBackdropClick={false}>
				<div>Modal Content</div>
			</Modal>,
			{ wrapper }
		)

		const backdrop = screen.getByRole('dialog')
		fireEvent.click(backdrop)

		expect(mockOnClose).not.toHaveBeenCalled()
	})

	it('body scroll is prevented when modal is open', () => {
		render(
			<Modal isOpen={true} onClose={mockOnClose}>
				<div>Modal Content</div>
			</Modal>,
			{ wrapper }
		)

		expect(document.body.style.overflow).toBe('hidden')
	})

	it('escape key does not close modal after it is closed', async () => {
		const user = userEvent.setup()
		const { rerender } = render(
			<Modal isOpen={true} onClose={mockOnClose}>
				<div>Modal Content</div>
			</Modal>,
			{ wrapper }
		)

		await user.keyboard('{Escape}')
		expect(mockOnClose).toHaveBeenCalledTimes(1)

		rerender(
			<Modal isOpen={false} onClose={mockOnClose}>
				<div>Modal Content</div>
			</Modal>
		)

		// Escape should not trigger onClose when modal is closed
		mockOnClose.mockClear()
		await user.keyboard('{Escape}')
		expect(mockOnClose).not.toHaveBeenCalled()
	})

	const FocusTestComponent = () => {
		const [isOpen, setIsOpen] = useState(false)
		return (
			<div>
				<button onClick={() => setIsOpen(true)}>Open Modal</button>
				<Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
					<button>Button 1</button>
					<button>Button 2</button>
					<input type="text" placeholder="Input" />
				</Modal>
			</div>
		)
	}

	it('focus is trapped inside the modal when open', async () => {
		const user = userEvent.setup()
		render(<FocusTestComponent />, { wrapper })

		// Open modal
		await user.click(screen.getByText('Open Modal'))

		// Initial focus should be on the first focusable element inside modal
		// Using waitFor because focus shift might happen in useEffect/animation frame
		await waitFor(() => expect(screen.getByText('Button 1')).toHaveFocus())

		// Tab to next element
		await user.tab()
		expect(screen.getByText('Button 2')).toHaveFocus()

		// Tab to input
		await user.tab()
		expect(screen.getByPlaceholderText('Input')).toHaveFocus()

		// Tab from last element (input) should cycle back to first (Button 1)
		await user.tab()
		expect(screen.getByText('Button 1')).toHaveFocus()

		// Shift+Tab from first element (Button 1) should cycle to last (input)
		await user.keyboard('{Shift>}{Tab}{/Shift}')
		expect(screen.getByPlaceholderText('Input')).toHaveFocus()
	})

	it('focus is restored to previous element when modal closes', async () => {
		const user = userEvent.setup()
		render(<FocusTestComponent />, { wrapper })

		const trigger = screen.getByText('Open Modal')

		// Ensure trigger has focus initially
		trigger.focus()
		expect(trigger).toHaveFocus()

		// Open modal
		await user.click(trigger)

		// Modal opens, focus moves inside
		await waitFor(() => expect(screen.getByText('Button 1')).toHaveFocus())

		// Close modal via Escape
		await user.keyboard('{Escape}')

		// Focus should return to trigger
		await waitFor(() => expect(trigger).toHaveFocus())
	})
})
