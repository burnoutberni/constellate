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
})
