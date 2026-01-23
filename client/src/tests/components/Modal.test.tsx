import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal } from '../../components/ui/Modal'
import { createTestWrapper } from '../testUtils'

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

	it('focus is trapped within modal when open', async () => {
		const user = userEvent.setup()
		render(
			<Modal isOpen={true} onClose={mockOnClose}>
				<button>First Button</button>
				<button>Second Button</button>
				<input type="text" placeholder="Input" />
			</Modal>,
			{ wrapper }
		)

		const firstButton = screen.getByText('First Button')
		const secondButton = screen.getByText('Second Button')
		const input = screen.getByPlaceholderText('Input')

		// Initial focus should be on first button
		expect(firstButton).toHaveFocus()

		// Tab should move to next element
		await user.tab()
		expect(secondButton).toHaveFocus()

		// Tab again should move to input
		await user.tab()
		expect(input).toHaveFocus()

		// Tab again should cycle back to first button
		await user.tab()
		expect(firstButton).toHaveFocus()

		// Shift+Tab should cycle to last element (input)
		await user.tab({ shift: true })
		expect(input).toHaveFocus()
	})

	it('focus is restored to previous element on close', async () => {
		const trigger = document.createElement('button')
		trigger.textContent = 'Trigger'
		document.body.appendChild(trigger)
		trigger.focus()

		const { unmount } = render(
			<Modal isOpen={true} onClose={mockOnClose}>
				<button>Inside</button>
			</Modal>,
			{ wrapper }
		)

		// Focus should have moved to inside button
		const inside = screen.getByText('Inside')
		expect(inside).toHaveFocus()

		unmount()

		// Wait for timeout in cleanup
		await new Promise((resolve) => setTimeout(resolve, 0))

		expect(trigger).toHaveFocus()

		document.body.removeChild(trigger)
	})
})
