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

	it('focuses the first focusable element when opened', async () => {
		render(
			<Modal isOpen={true} onClose={mockOnClose}>
				<button>First</button>
				<button>Second</button>
			</Modal>,
			{ wrapper }
		)

		const firstButton = screen.getByText('First')
		expect(document.activeElement).toBe(firstButton)
	})

	it('traps focus inside the modal', async () => {
		const user = userEvent.setup()
		render(
			<Modal isOpen={true} onClose={mockOnClose}>
				<button>First</button>
				<button>Second</button>
			</Modal>,
			{ wrapper }
		)

		const firstButton = screen.getByText('First')
		const secondButton = screen.getByText('Second')

		// Initial focus
		expect(document.activeElement).toBe(firstButton)

		// Tab to second
		await user.tab()
		expect(document.activeElement).toBe(secondButton)

		// Tab wraps around to first
		await user.tab()
		expect(document.activeElement).toBe(firstButton)

		// Shift+Tab wraps around to second (last)
		await user.tab({ shift: true })
		expect(document.activeElement).toBe(secondButton)
	})

	it('restores focus when closed', async () => {
		const { rerender } = render(
			<button data-testid="trigger">Trigger</button>,
			{ wrapper }
		)

		const trigger = screen.getByTestId('trigger')
		trigger.focus()
		expect(document.activeElement).toBe(trigger)

		// Open modal
		rerender(
			<>
				<button data-testid="trigger">Trigger</button>
				<Modal isOpen={true} onClose={mockOnClose}>
					<button>Inside</button>
				</Modal>
			</>
		)

		const inside = screen.getByText('Inside')
		expect(document.activeElement).toBe(inside)

		// Close modal
		rerender(
			<>
				<button data-testid="trigger">Trigger</button>
				<Modal isOpen={false} onClose={mockOnClose}>
					<button>Inside</button>
				</Modal>
			</>
		)

		// Focus should be restored (handled by cleanup)
		// Note: React testing library rerender might not trigger cleanup/mount in the same way as real DOM unmount/remount
		// unless the component type changes or key changes. But here `isOpen` changes, so the `useEffect` cleanup should run.
		expect(document.activeElement).toBe(trigger)
	})
})
