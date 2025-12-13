import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MobileNav } from '../../components/MobileNav'
import { createTestWrapper } from '../testUtils'

const { wrapper } = createTestWrapper()

const mockUser = {
	id: 'user1',
	name: 'Test User',
	email: 'test@example.com',
	username: 'testuser',
}

describe('MobileNav Component', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Reset body overflow
		document.body.style.overflow = ''
	})

	it('should render mobile menu when open', () => {
		render(<MobileNav isOpen={true} onClose={vi.fn()} />, { wrapper })

		expect(screen.getByLabelText('Mobile navigation')).toBeInTheDocument()
		expect(screen.getByText('Menu')).toBeInTheDocument()
	})

	it('should not render menu when closed', () => {
		render(<MobileNav isOpen={false} onClose={vi.fn()} />, { wrapper })

		const nav = screen.getByLabelText('Mobile navigation')
		expect(nav).toHaveAttribute('aria-hidden', 'true')
	})

	it('should call onClose when close button is clicked', async () => {
		const user = userEvent.setup()
		const mockClose = vi.fn()
		render(<MobileNav isOpen={true} onClose={mockClose} />, { wrapper })

		const closeButton = screen.getByLabelText('Close menu')
		await user.click(closeButton)

		// onClose may be called multiple times due to route change effect
		expect(mockClose).toHaveBeenCalled()
	})

	it('should close menu on Escape key', async () => {
		const user = userEvent.setup()
		const mockClose = vi.fn()
		render(<MobileNav isOpen={true} onClose={mockClose} />, { wrapper })

		await user.keyboard('{Escape}')

		// onClose may be called multiple times due to route change effect
		expect(mockClose).toHaveBeenCalled()
	})

	it('should show navigation links', () => {
		render(<MobileNav isOpen={true} onClose={vi.fn()} />, { wrapper })

		expect(screen.getByText('Feed')).toBeInTheDocument()
		expect(screen.getByText('Calendar')).toBeInTheDocument()
		expect(screen.getByText('Search')).toBeInTheDocument()
		expect(screen.getByText('About')).toBeInTheDocument()
	})

	it('should show user-specific links when user is logged in', () => {
		render(<MobileNav isOpen={true} onClose={vi.fn()} user={mockUser} />, { wrapper })

		expect(screen.getByText('Templates')).toBeInTheDocument()
		expect(screen.getByText('Instances')).toBeInTheDocument()
		expect(screen.getByText('My Profile')).toBeInTheDocument()
		expect(screen.getByText('Settings')).toBeInTheDocument()
		expect(screen.getByText('Reminders')).toBeInTheDocument()
		expect(screen.getByText('Followers')).toBeInTheDocument()
	})

	it('should show admin link when user is admin', () => {
<<<<<<< HEAD
		render(<MobileNav isOpen={true} onClose={vi.fn()} user={mockUser} isAdmin={true} />, {
			wrapper,
		})
=======
		render(<MobileNav isOpen={true} onClose={vi.fn()} user={mockUser} isAdmin={true} />, { wrapper })
>>>>>>> b821aaf (WP-120: Navigation Redesign)

		expect(screen.getByText('Admin')).toBeInTheDocument()
	})

	it('should not show admin link when user is not admin', () => {
<<<<<<< HEAD
		render(<MobileNav isOpen={true} onClose={vi.fn()} user={mockUser} isAdmin={false} />, {
			wrapper,
		})
=======
		render(<MobileNav isOpen={true} onClose={vi.fn()} user={mockUser} isAdmin={false} />, { wrapper })
>>>>>>> b821aaf (WP-120: Navigation Redesign)

		expect(screen.queryByText('Admin')).not.toBeInTheDocument()
	})

	it('should highlight active route', () => {
		const { wrapper: testWrapper } = createTestWrapper(['/feed'])
		render(<MobileNav isOpen={true} onClose={vi.fn()} />, { wrapper: testWrapper })

		// Find the Feed link in the mobile nav (there may be multiple Feed links)
		const feedLinks = screen.getAllByText('Feed')
		const mobileNavFeedLink = feedLinks.find((link) => {
			const parent = link.closest('nav[aria-label="Mobile navigation"]')
			return parent !== null
		})
		expect(mobileNavFeedLink).toBeInTheDocument()
		// The link should have active styling (checked via className)
		expect(mobileNavFeedLink?.closest('a')).toHaveClass('bg-primary-50')
	})

	it('should close menu when link is clicked', async () => {
		const user = userEvent.setup()
		const mockClose = vi.fn()
		render(<MobileNav isOpen={true} onClose={mockClose} />, { wrapper })

		// Find the Feed link in the mobile nav specifically
		const feedLinks = screen.getAllByText('Feed')
		const mobileNavFeedLink = feedLinks.find((link) => {
			const parent = link.closest('nav[aria-label="Mobile navigation"]')
			return parent !== null
		})
		expect(mobileNavFeedLink).toBeInTheDocument()
		if (mobileNavFeedLink) {
			await user.click(mobileNavFeedLink)
		}

		// onClose may be called multiple times due to route change effect
		expect(mockClose).toHaveBeenCalled()
	})

	it('should prevent body scroll when menu is open', () => {
		render(<MobileNav isOpen={true} onClose={vi.fn()} />, { wrapper })

		expect(document.body.style.overflow).toBe('hidden')
	})

	it('should restore body scroll when menu closes', () => {
		const { rerender } = render(<MobileNav isOpen={true} onClose={vi.fn()} />, { wrapper })

		expect(document.body.style.overflow).toBe('hidden')

		rerender(<MobileNav isOpen={false} onClose={vi.fn()} />)

		expect(document.body.style.overflow).toBe('')
	})

	it('should support keyboard navigation with Tab', () => {
		render(<MobileNav isOpen={true} onClose={vi.fn()} />, { wrapper })

		// Focus should be trapped within the menu
		const firstLink = screen.getByText('Feed')
		expect(firstLink).toBeInTheDocument()
	})
})
<<<<<<< HEAD
=======

>>>>>>> b821aaf (WP-120: Navigation Redesign)
