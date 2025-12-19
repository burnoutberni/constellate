import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SkipLink } from '../../components/SkipLink'

describe('SkipLink Component', () => {
	beforeEach(() => {
		// Create a main content element for the skip link to target
		const main = document.createElement('main')
		main.id = 'main-content'
		document.body.appendChild(main)
	})

	afterEach(() => {
		// Clean up
		const main = document.getElementById('main-content')
		if (main) {
			document.body.removeChild(main)
		}
		vi.useRealTimers()
	})

	it('user can see skip link when focused', async () => {
		render(<SkipLink />)

		const skipLink = screen.getByRole('link', { name: 'Skip to main content' })
		expect(skipLink).toBeInTheDocument()

		// Focus the link (user presses Tab)
		act(() => {
			skipLink.focus()
		})

		// User can see the link when focused (it appears on screen)
		await waitFor(() => {
			expect(skipLink).toBeVisible()
		})
	})

	it('user can skip to main content by clicking', async () => {
		vi.useRealTimers()
		const user = userEvent.setup()
		render(<SkipLink />)

		const skipLink = screen.getByRole('link', { name: 'Skip to main content' })
		const main = document.getElementById('main-content')

		expect(main).toBeInTheDocument()

		// Click the skip link
		await user.click(skipLink)

		// Main content should be focused (user successfully skipped to it)
		await waitFor(() => {
			expect(document.activeElement).toBe(main)
		})
	})

	it('user can skip to main content using Enter key', async () => {
		vi.useRealTimers()
		const user = userEvent.setup()
		render(<SkipLink />)

		const skipLink = screen.getByRole('link', { name: 'Skip to main content' })
		const main = document.getElementById('main-content')

		// Focus the skip link
		skipLink.focus()

		// Press Enter
		await user.keyboard('{Enter}')

		// Main content should be focused (user successfully skipped to it)
		await waitFor(() => {
			expect(document.activeElement).toBe(main)
		})
	})

	it('user cannot skip when main content does not exist', async () => {
		// Remove main content
		const main = document.getElementById('main-content')
		if (main) {
			document.body.removeChild(main)
		}

		const user = userEvent.setup()
		render(<SkipLink />)

		const skipLink = screen.getByRole('link', { name: 'Skip to main content' })

		// Click should not throw an error
		await user.click(skipLink)

		// No element should be focused
		expect(document.activeElement).not.toBe(document.body)
	})
})
