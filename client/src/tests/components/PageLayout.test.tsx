import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PageLayout } from '../../components/layout/PageLayout'
import { SkipLink } from '../../components/SkipLink'

describe('PageLayout Component', () => {
	it('user can see main content', () => {
		render(
			<PageLayout>
				<div>Main content here</div>
			</PageLayout>
		)

		expect(screen.getByText('Main content here')).toBeInTheDocument()
		expect(screen.getByRole('main')).toBeInTheDocument()
	})

	it('user can see header when provided', () => {
		render(
			<PageLayout header={<header>Header Content</header>}>
				<div>Main content</div>
			</PageLayout>
		)

		expect(screen.getByText('Header Content')).toBeInTheDocument()
	})

	it('user can see footer when provided', () => {
		render(
			<PageLayout footer={<footer>Footer Content</footer>}>
				<div>Main content</div>
			</PageLayout>
		)

		expect(screen.getByText('Footer Content')).toBeInTheDocument()
	})

	it('user can see sidebar when provided', () => {
		render(
			<PageLayout sidebar={<aside>Sidebar Content</aside>}>
				<div>Main content</div>
			</PageLayout>
		)

		expect(screen.getByText('Sidebar Content')).toBeInTheDocument()
		expect(screen.getByText('Main content')).toBeInTheDocument()
	})

	it('skip link can navigate to main content in PageLayout', async () => {
		const user = userEvent.setup()
		render(
			<>
				<SkipLink />
				<PageLayout>
					<div>Test content</div>
				</PageLayout>
			</>
		)

		const skipLink = screen.getByRole('link', { name: 'Skip to main content' })
		const main = screen.getByRole('main')

		// User can click skip link to focus main content
		await user.click(skipLink)

		await waitFor(() => {
			expect(document.activeElement).toBe(main)
		})
	})
})

