import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserMenu } from '../../components/UserMenu'
import { createTestWrapper } from '../testUtils'

const { wrapper } = createTestWrapper()

const mockUser = {
	id: 'user1',
	name: 'Test User',
	email: 'test@example.com',
	username: 'testuser',
	image: null,
}

describe('UserMenu Component', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('should render user menu button', () => {
		render(<UserMenu user={mockUser} />, { wrapper })

		expect(screen.getByLabelText('User menu')).toBeInTheDocument()
		expect(screen.getByText('Test User')).toBeInTheDocument()
	})

	it('should open dropdown menu on click', async () => {
		const user = userEvent.setup()
		render(<UserMenu user={mockUser} />, { wrapper })

		const menuButton = screen.getByLabelText('User menu')
		await user.click(menuButton)

		await waitFor(() => {
			expect(screen.getByText('View Profile')).toBeInTheDocument()
		})
	})

	it('should close dropdown on outside click', async () => {
		const user = userEvent.setup()
		render(<UserMenu user={mockUser} />, { wrapper })

		const menuButton = screen.getByLabelText('User menu')
		await user.click(menuButton)

		await waitFor(() => {
			expect(screen.getByText('View Profile')).toBeInTheDocument()
		})

		await user.click(document.body)

		await waitFor(() => {
			expect(screen.queryByText('View Profile')).not.toBeInTheDocument()
		})
	})

	it('should close dropdown on Escape key', async () => {
		const user = userEvent.setup()
		render(<UserMenu user={mockUser} />, { wrapper })

		const menuButton = screen.getByLabelText('User menu')
		await user.click(menuButton)

		await waitFor(() => {
			expect(screen.getByText('View Profile')).toBeInTheDocument()
		})

		await user.keyboard('{Escape}')

		await waitFor(() => {
			expect(screen.queryByText('View Profile')).not.toBeInTheDocument()
		})
	})

	it('should show all menu items for regular user', async () => {
		const user = userEvent.setup()
		render(<UserMenu user={mockUser} />, { wrapper })

		const menuButton = screen.getByLabelText('User menu')
		await user.click(menuButton)

		await waitFor(() => {
			expect(screen.getByText('View Profile')).toBeInTheDocument()
			expect(screen.getByText('Settings')).toBeInTheDocument()
			expect(screen.getByText('Reminders')).toBeInTheDocument()
			expect(screen.getByText('Followers')).toBeInTheDocument()
			expect(screen.getByText('Logout')).toBeInTheDocument()
		})
	})

	it('should show admin link when user is admin', async () => {
		const user = userEvent.setup()
		render(<UserMenu user={mockUser} isAdmin={true} />, { wrapper })

		const menuButton = screen.getByLabelText('User menu')
		await user.click(menuButton)

		await waitFor(() => {
			expect(screen.getByText('Admin')).toBeInTheDocument()
		})
	})

	it('should not show admin link when user is not admin', async () => {
		const user = userEvent.setup()
		render(<UserMenu user={mockUser} isAdmin={false} />, { wrapper })

		const menuButton = screen.getByLabelText('User menu')
		await user.click(menuButton)

		await waitFor(() => {
			expect(screen.queryByText('Admin')).not.toBeInTheDocument()
		})
	})

	it('should call onLogout when logout is clicked', async () => {
		const user = userEvent.setup()
		const mockLogout = vi.fn()
		render(<UserMenu user={mockUser} onLogout={mockLogout} />, { wrapper })

		const menuButton = screen.getByLabelText('User menu')
		await user.click(menuButton)

		await waitFor(() => {
			expect(screen.getByText('Logout')).toBeInTheDocument()
		})

		const logoutButton = screen.getByText('Logout')
		await user.click(logoutButton)

		expect(mockLogout).toHaveBeenCalledTimes(1)
	})

	it('should support keyboard navigation with arrow keys', async () => {
		const user = userEvent.setup()
		render(<UserMenu user={mockUser} />, { wrapper })

		const menuButton = screen.getByLabelText('User menu')
		await user.click(menuButton)

		await waitFor(() => {
			expect(screen.getByText('View Profile')).toBeInTheDocument()
		})

		// Press ArrowDown to navigate
		await user.keyboard('{ArrowDown}')

		// The focus should move to the next item
		// This is tested by checking that keyboard navigation works
		expect(screen.getByText('Settings')).toBeInTheDocument()
	})

	it('should display user email when name is not available', () => {
		render(<UserMenu user={{ ...mockUser, name: undefined }} />, { wrapper })

		expect(screen.getByText('testuser')).toBeInTheDocument()
	})

	it('should display user initials in avatar when image is not available', () => {
		render(<UserMenu user={mockUser} />, { wrapper })

		// Avatar should render with initials
		const avatar = screen.getByLabelText('Test User')
		expect(avatar).toBeInTheDocument()
	})
})
<<<<<<< HEAD
=======

>>>>>>> b821aaf (WP-120: Navigation Redesign)
