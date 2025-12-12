import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CommentForm } from '../../components/CommentForm'

// Mock fetch for mention suggestions
global.fetch = vi.fn()

describe('CommentForm Component', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('should render with default placeholder', () => {
		render(<CommentForm onSubmit={vi.fn()} />)
		expect(screen.getByPlaceholderText('Add a comment...')).toBeInTheDocument()
	})

	it('should render with custom placeholder', () => {
		render(<CommentForm onSubmit={vi.fn()} placeholder="Write a reply..." />)
		expect(screen.getByPlaceholderText('Write a reply...')).toBeInTheDocument()
	})

	it('should disable submit button when content is empty', () => {
		render(<CommentForm onSubmit={vi.fn()} />)
		const submitButton = screen.getByRole('button', { name: /Post Comment/i })
		expect(submitButton).toBeDisabled()
	})

	it('should enable submit button when content is provided', async () => {
		const user = userEvent.setup()
		render(<CommentForm onSubmit={vi.fn()} />)

		const textarea = screen.getByPlaceholderText('Add a comment...')
		await user.type(textarea, 'Test comment')

		const submitButton = screen.getByRole('button', { name: /Post Comment/i })
		expect(submitButton).not.toBeDisabled()
	})

	it('should call onSubmit with content when form is submitted', async () => {
		const user = userEvent.setup()
		const mockSubmit = vi.fn().mockResolvedValue(undefined)
		render(<CommentForm onSubmit={mockSubmit} />)

		const textarea = screen.getByPlaceholderText('Add a comment...')
		await user.type(textarea, 'Test comment')

		const submitButton = screen.getByRole('button', { name: /Post Comment/i })
		await user.click(submitButton)

		await waitFor(() => {
			expect(mockSubmit).toHaveBeenCalledWith('Test comment')
		})
	})

	it('should clear content after successful submission', async () => {
		const user = userEvent.setup()
		const mockSubmit = vi.fn().mockResolvedValue(undefined)
		render(<CommentForm onSubmit={mockSubmit} />)

		const textarea = screen.getByPlaceholderText('Add a comment...')
		await user.type(textarea, 'Test comment')

		const submitButton = screen.getByRole('button', { name: /Post Comment/i })
		await user.click(submitButton)

		// After submission, textarea should be empty (user-visible behavior)
		await waitFor(() => {
			expect(screen.getByPlaceholderText('Add a comment...')).toHaveValue('')
		})
	})

	it('should show cancel button when onCancel is provided', () => {
		const mockCancel = vi.fn()
		render(<CommentForm onSubmit={vi.fn()} onCancel={mockCancel} />)

		expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument()
	})

	it('should call onCancel when cancel button is clicked', async () => {
		const user = userEvent.setup()
		const mockCancel = vi.fn()
		render(<CommentForm onSubmit={vi.fn()} onCancel={mockCancel} />)

		const cancelButton = screen.getByRole('button', { name: /Cancel/i })
		await user.click(cancelButton)

		expect(mockCancel).toHaveBeenCalled()
	})

	it('should show custom submit label', () => {
		render(<CommentForm onSubmit={vi.fn()} submitLabel="Reply" />)
		expect(screen.getByRole('button', { name: /Reply/i })).toBeInTheDocument()
	})
})
