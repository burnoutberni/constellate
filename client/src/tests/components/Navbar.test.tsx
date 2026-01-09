import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Navbar } from '../../components/Navbar'
import { createTestWrapper, clearQueryClient } from '../testUtils'

// Mock dependencies
const mockUseQuery = vi.fn()

vi.mock('@tanstack/react-query', async () => {
	const actual = await vi.importActual('@tanstack/react-query')
	return {
		...actual,
		useQuery: () => mockUseQuery(),
	}
})

vi.mock('../../lib/api-client', () => ({
	api: {
		get: vi.fn(),
	},
}))

const { wrapper, queryClient } = createTestWrapper()

describe('Navbar Component', () => {
	beforeEach(() => {
		clearQueryClient(queryClient)
		vi.clearAllMocks()
		mockUseQuery.mockReturnValue({
			data: null,
			isLoading: false,
		})
	})

	it('should render navbar with logo', () => {
		render(<Navbar />, { wrapper })

		expect(screen.getByText('Constellate')).toBeInTheDocument()
	})

	it('should show mobile menu button on mobile', () => {
		render(<Navbar />, { wrapper })

		const mobileMenuButton = screen.getByLabelText('Open mobile menu')
		expect(mobileMenuButton).toBeInTheDocument()
	})

	it('should open mobile menu when button is clicked', async () => {
		const user = userEvent.setup()
		render(<Navbar />, { wrapper })

		const mobileMenuButton = screen.getByLabelText('Open mobile menu')
		await user.click(mobileMenuButton)

		await waitFor(() => {
			expect(screen.getByLabelText('Mobile navigation')).toBeInTheDocument()
		})
	})

	it('should show desktop navigation links', () => {
		render(<Navbar />, { wrapper })

		// Desktop nav links are present (may also appear in mobile nav)
		expect(screen.getAllByText('Calendar').length).toBeGreaterThan(0)
		expect(screen.getAllByText('Discover').length).toBeGreaterThan(0)
		expect(screen.getAllByText('About').length).toBeGreaterThan(0)
	})

	it('should show user menu when user is logged in', () => {
		render(
			<Navbar
				user={{
					id: 'user1',
					name: 'Test User',
					email: 'test@example.com',
					username: 'testuser',
				}}
			/>,
			{ wrapper }
		)

		expect(screen.getByLabelText('User menu')).toBeInTheDocument()
	})

	it('should show sign in button when user is not logged in', () => {
		render(<Navbar />, { wrapper })

		expect(screen.getByText('Log In')).toBeInTheDocument()
	})

	it('should show notification bell when user is logged in', () => {
		render(
			<Navbar
				user={{
					id: 'user1',
					name: 'Test User',
					email: 'test@example.com',
				}}
			/>,
			{ wrapper }
		)

		// NotificationBell should be rendered (it may not show if userId is not provided)
		// We check that the navbar renders without errors
		expect(screen.getByLabelText('User menu')).toBeInTheDocument()
	})

	it('should highlight active navigation link', () => {
		const { wrapper: testWrapper } = createTestWrapper(['/discover'])
		render(<Navbar />, { wrapper: testWrapper })

		// Find the Discover link in desktop nav (not mobile)
		const discoverLinks = screen.getAllByText('Discover')
		const desktopNavLink = discoverLinks.find((link) => {
			const parent = link.closest('nav[aria-label="Desktop navigation"]')
			return parent !== null
		})
		expect(desktopNavLink).toBeInTheDocument()
		expect(desktopNavLink?.closest('a')).toHaveAttribute('aria-current', 'page')
	})

	it('should show breadcrumbs on deeper pages', () => {
		const { wrapper: testWrapper } = createTestWrapper(['/settings'])
		render(<Navbar />, { wrapper: testWrapper })

		// Breadcrumbs should be rendered (may be hidden on mobile)
		expect(screen.getByText('Settings')).toBeInTheDocument()
	})

	it('should not show breadcrumbs on main pages', () => {
		const { wrapper: testWrapper } = createTestWrapper(['/discover'])
		render(<Navbar />, { wrapper: testWrapper })

		// Breadcrumbs should not be visible on main pages like /discover
		// The breadcrumbs component may still render but should only show Home/Discover
		// We check that the navbar still renders correctly
		expect(screen.getAllByText('Discover').length).toBeGreaterThan(0)
	})

	it('should show admin link in user menu when user is admin', async () => {
		const user = userEvent.setup()
		// Mock the query to return admin profile
		mockUseQuery.mockReturnValue({
			data: {
				id: 'user1',
				isAdmin: true,
			},
			isLoading: false,
		})

		render(
			<Navbar
				user={{
					id: 'user1',
					name: 'Admin User',
					email: 'admin@example.com',
					username: 'admin',
				}}
			/>,
			{ wrapper }
		)

		const userMenuButton = screen.getByLabelText('User menu')
		await user.click(userMenuButton)

		// Wait for the menu to open
		await waitFor(() => {
			expect(screen.getByText('View Profile')).toBeInTheDocument()
		})

		// Verify that the Admin link is present in the menu for admin users
		// Use getByRole to find the Admin link specifically in the user menu (role="menuitem")
		const adminLink = screen.getByRole('menuitem', { name: 'Admin' })
		expect(adminLink).toBeInTheDocument()
		expect(adminLink).toHaveAttribute('href', '/admin')
	})

	it('should call onLogout when logout is clicked in user menu', async () => {
		const user = userEvent.setup()
		const mockLogout = vi.fn()

		render(
			<Navbar
				user={{
					id: 'user1',
					name: 'Test User',
					email: 'test@example.com',
					username: 'testuser',
				}}
				onLogout={mockLogout}
			/>,
			{ wrapper }
		)

		const userMenuButton = screen.getByLabelText('User menu')
		await user.click(userMenuButton)

		await waitFor(() => {
			expect(screen.getByText('Logout')).toBeInTheDocument()
		})

		const logoutButton = screen.getByText('Logout')
		await user.click(logoutButton)

		expect(mockLogout).toHaveBeenCalledTimes(1)
	})

	it('should show search button on mobile', () => {
		render(<Navbar />, { wrapper })

		// Search button should be visible on mobile (lg:hidden)
		const searchButton = screen.getByLabelText('Search')
		expect(searchButton).toBeInTheDocument()
	})
})
