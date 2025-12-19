import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import App from '../App'
import { createTestWrapper, clearQueryClient } from './testUtils'
import { api } from '../lib/api-client'

// Mock all hooks and dependencies
const mockAddToast = vi.fn()
vi.mock('../stores', () => ({
	// eslint-disable-next-line no-unused-vars
	useUIStore: (selector: (state: { addToast: typeof mockAddToast }) => unknown) => {
		const mockState = {
			addToast: mockAddToast,
		}
		return selector(mockState)
	},
	MAX_MESSAGE_LENGTH: 1000,
}))

const mockUser = null
const mockAuthLoading = false
const mockTosStatus = { needsAcceptance: false }
vi.mock('../hooks/useAuth', () => ({
	useAuth: () => ({
		user: mockUser,
		loading: mockAuthLoading,
		tosStatus: mockTosStatus,
	}),
}))

vi.mock('../hooks/useRealtimeSSE', () => ({
	useRealtimeSSE: vi.fn(),
}))

vi.mock('../lib/api-client', () => ({
	api: {
		get: vi.fn().mockResolvedValue({ setupRequired: false }),
	},
}))

vi.mock('../lib/logger', () => ({
	logger: {
		error: vi.fn(),
	},
	configureLogger: vi.fn(),
}))

// Mock all lazy-loaded pages to return simple test components
const createMockPage = (name: string) => {
	return () => <div data-testid={name}>{name}</div>
}

vi.mock('../pages/AboutPage', () => ({
	AboutPage: createMockPage('AboutPage'),
}))

vi.mock('../pages/AdminPage', () => ({
	AdminPage: createMockPage('AdminPage'),
}))

vi.mock('../pages/AppealsPage', () => ({
	AppealsPage: createMockPage('AppealsPage'),
}))

vi.mock('../pages/CalendarPage', () => ({
	CalendarPage: createMockPage('CalendarPage'),
}))

vi.mock('../pages/DiscoverPage', () => ({
	DiscoverPage: createMockPage('DiscoverPage'),
}))

vi.mock('../pages/EditEventPage', () => ({
	EditEventPage: createMockPage('EditEventPage'),
}))

vi.mock('../pages/FeedPage', () => ({
	FeedPage: createMockPage('FeedPage'),
}))

vi.mock('../pages/HomePage', () => ({
	HomePage: createMockPage('HomePage'),
}))

vi.mock('../pages/InstanceDetailPage', () => ({
	InstanceDetailPage: createMockPage('InstanceDetailPage'),
}))

vi.mock('../pages/InstancesPage', () => ({
	InstancesPage: createMockPage('InstancesPage'),
}))

vi.mock('../pages/LoginPage', () => ({
	LoginPage: createMockPage('LoginPage'),
}))

vi.mock('../pages/ModerationPracticesPage', () => ({
	ModerationPracticesPage: createMockPage('ModerationPracticesPage'),
}))

vi.mock('../pages/NotificationsPage', () => ({
	NotificationsPage: createMockPage('NotificationsPage'),
}))

vi.mock('../pages/OnboardingPage', () => ({
	OnboardingPage: createMockPage('OnboardingPage'),
}))

vi.mock('../pages/PendingFollowersPage', () => ({
	PendingFollowersPage: createMockPage('PendingFollowersPage'),
}))

vi.mock('../pages/PrivacyPolicyPage', () => ({
	PrivacyPolicyPage: createMockPage('PrivacyPolicyPage'),
}))

vi.mock('../pages/RemindersPage', () => ({
	RemindersPage: createMockPage('RemindersPage'),
}))

vi.mock('../pages/ReportsPage', () => ({
	ReportsPage: createMockPage('ReportsPage'),
}))

vi.mock('../pages/SettingsPage', () => ({
	SettingsPage: createMockPage('SettingsPage'),
}))

vi.mock('../pages/TemplatesPage', () => ({
	TemplatesPage: createMockPage('TemplatesPage'),
}))

vi.mock('../pages/TermsOfServicePage', () => ({
	TermsOfServicePage: createMockPage('TermsOfServicePage'),
}))

vi.mock('../pages/NotFoundPage', () => ({
	NotFoundPage: () => (
		<div data-testid="NotFoundPage">
			<h1>Page Not Found</h1>
			<p>We looked everywhere, but we couldn&apos;t find the page you&apos;re looking for.</p>
		</div>
	),
}))

// Don't mock ProfileOrEventPage - we want to test the actual routing behavior

vi.mock('../pages/UserProfilePage', () => ({
	UserProfilePage: createMockPage('UserProfilePage'),
}))

vi.mock('../pages/EventDetailPage', () => ({
	EventDetailPage: createMockPage('EventDetailPage'),
}))

// Mock other components that are always rendered
vi.mock('../components/ErrorBoundary', () => ({
	ErrorBoundary: ({ children }: { children: ReactNode }) => children,
}))

vi.mock('../components/Footer', () => ({
	Footer: () => <footer data-testid="footer">Footer</footer>,
}))

vi.mock('../components/MentionNotifications', () => ({
	MentionNotifications: () => null,
}))

vi.mock('../components/SkipLink', () => ({
	SkipLink: () => null,
}))

vi.mock('../components/Toast', () => ({
	Toasts: () => null,
}))

vi.mock('../components/TosAcceptanceModal', () => ({
	TosAcceptanceModal: () => null,
}))

vi.mock('../components/ui', () => ({
	PageLoader: () => <div data-testid="PageLoader">Loading...</div>,
}))

vi.mock('../contexts/AuthContext', () => ({
	AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

describe('App Routing', () => {
	const { queryClient } = createTestWrapper()

	beforeEach(() => {
		clearQueryClient(queryClient)
		vi.clearAllMocks()
		sessionStorage.clear()
		// Ensure API mock resolves immediately
		vi.mocked(api.get).mockResolvedValue({ setupRequired: false })
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	it('should render HomePage for root path', async () => {
		const { wrapper: testWrapper } = createTestWrapper(['/'])
		render(<App />, { wrapper: testWrapper })

		// Wait for setup check to complete (PageLoader should disappear)
		await waitFor(() => {
			expect(screen.queryByTestId('PageLoader')).not.toBeInTheDocument()
		})

		// Then wait for the page to render
		await waitFor(() => {
			expect(screen.getByTestId('HomePage')).toBeInTheDocument()
		})
	})

	it('should render NotFoundPage for unmatched paths', async () => {
		const { wrapper: testWrapper } = createTestWrapper(['/nonexistent-page'])
		render(<App />, { wrapper: testWrapper })

		// Wait for setup check to complete
		await waitFor(() => {
			expect(screen.queryByTestId('PageLoader')).not.toBeInTheDocument()
		})

		await waitFor(() => {
			expect(screen.getByTestId('NotFoundPage')).toBeInTheDocument()
			expect(screen.getByText('Page Not Found')).toBeInTheDocument()
		})
	})

	it('should render NotFoundPage for arbitrary invalid paths', async () => {
		const { wrapper: testWrapper } = createTestWrapper(['/random/path/that/does/not/exist'])
		render(<App />, { wrapper: testWrapper })

		// Wait for setup check to complete
		await waitFor(() => {
			expect(screen.queryByTestId('PageLoader')).not.toBeInTheDocument()
		})

		await waitFor(() => {
			expect(screen.getByTestId('NotFoundPage')).toBeInTheDocument()
		})
	})

	it('should render NotFoundPage for paths that do not start with /@', async () => {
		const { wrapper: testWrapper } = createTestWrapper(['/invalid-route'])
		render(<App />, { wrapper: testWrapper })

		// Wait for setup check to complete
		await waitFor(() => {
			expect(screen.queryByTestId('PageLoader')).not.toBeInTheDocument()
		})

		await waitFor(() => {
			expect(screen.getByTestId('NotFoundPage')).toBeInTheDocument()
		})
	})

	it('should render NotFoundPage when accessing /404 directly', async () => {
		const { wrapper: testWrapper } = createTestWrapper(['/404'])
		render(<App />, { wrapper: testWrapper })

		await waitFor(() => {
			expect(screen.getByTestId('NotFoundPage')).toBeInTheDocument()
		})
	})

	it('should route to UserProfilePage for paths starting with /@username', async () => {
		const { wrapper: testWrapper } = createTestWrapper(['/@username'])
		render(<App />, { wrapper: testWrapper })

		// Wait for setup check to complete
		await waitFor(() => {
			expect(screen.queryByTestId('PageLoader')).not.toBeInTheDocument()
		})

		// ProfileOrEventPage should route to UserProfilePage for single-segment @ paths
		await waitFor(() => {
			expect(screen.getByTestId('UserProfilePage')).toBeInTheDocument()
			expect(screen.queryByTestId('NotFoundPage')).not.toBeInTheDocument()
		})
	})

	it('should route to EventDetailPage for paths starting with /@username/eventId', async () => {
		const { wrapper: testWrapper } = createTestWrapper(['/@username/event123'])
		render(<App />, { wrapper: testWrapper })

		// Wait for setup check to complete
		await waitFor(() => {
			expect(screen.queryByTestId('PageLoader')).not.toBeInTheDocument()
		})

		// ProfileOrEventPage should route to EventDetailPage for two-segment @ paths
		await waitFor(() => {
			expect(screen.getByTestId('EventDetailPage')).toBeInTheDocument()
			expect(screen.queryByTestId('NotFoundPage')).not.toBeInTheDocument()
		})
	})

	it('should render valid routes correctly', async () => {
		const routes = [
			{ path: '/about', testId: 'AboutPage' },
			{ path: '/feed', testId: 'FeedPage' },
			{ path: '/calendar', testId: 'CalendarPage' },
			{ path: '/discover', testId: 'DiscoverPage' },
			{ path: '/settings', testId: 'SettingsPage' },
			{ path: '/login', testId: 'LoginPage' },
		]

		for (const route of routes) {
			const { wrapper: testWrapper } = createTestWrapper([route.path])
			const { unmount } = render(<App />, { wrapper: testWrapper })

			// Wait for setup check to complete
			await waitFor(() => {
				expect(screen.queryByTestId('PageLoader')).not.toBeInTheDocument()
			})

			await waitFor(() => {
				expect(screen.getByTestId(route.testId)).toBeInTheDocument()
			})

			unmount()
		}
	})

	it('should handle paths with query parameters correctly', async () => {
		const { wrapper: testWrapper } = createTestWrapper(['/invalid?param=value'])
		render(<App />, { wrapper: testWrapper })

		await waitFor(() => {
			expect(screen.getByTestId('NotFoundPage')).toBeInTheDocument()
		})
	})

	it('should handle paths with hash fragments correctly', async () => {
		const { wrapper: testWrapper } = createTestWrapper(['/invalid#section'])
		render(<App />, { wrapper: testWrapper })

		await waitFor(() => {
			expect(screen.getByTestId('NotFoundPage')).toBeInTheDocument()
		})
	})
})
