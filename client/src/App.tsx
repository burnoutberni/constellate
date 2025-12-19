import { QueryClientProvider } from '@tanstack/react-query'
import {
	useEffect,
	useState,
	useMemo,
	lazy,
	Suspense,
	type LazyExoticComponent,
	type ComponentType,
} from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'

import { ErrorBoundary } from './components/ErrorBoundary'
import { Footer } from './components/Footer'
import { MentionNotifications } from './components/MentionNotifications'
import { SkipLink } from './components/SkipLink'
import { Toasts } from './components/Toast'
import { TosAcceptanceModal } from './components/TosAcceptanceModal'
import { PageLoader } from './components/ui'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './design-system'
import { useAuth } from './hooks/useAuth'
import { useRealtimeSSE } from './hooks/useRealtimeSSE'
import { api } from './lib/api-client'
import { logger, configureLogger } from './lib/logger'
import { queryClient } from './lib/queryClient'
import { TOAST_ON_LOAD_KEY } from './lib/storageConstants'
import { generateId } from './lib/utils'
import { MAX_MESSAGE_LENGTH, useUIStore } from './stores'

/**
 * Helper function to create a lazy-loaded component from a named export.
 * @param importPath - The path to the module (e.g., './pages/AboutPage')
 * @param componentName - The name of the exported component (e.g., 'AboutPage')
 * @returns A lazy-loaded React component
 */
function createLazyPage<T extends string>(
	importPath: string,
	componentName: T
): LazyExoticComponent<ComponentType> {
	return lazy(() =>
		import(importPath).then((module) => ({
			default: module[componentName],
		}))
	)
}

// Lazy load pages
const AboutPage = createLazyPage('./pages/AboutPage', 'AboutPage')
const AdminPage = createLazyPage('./pages/AdminPage', 'AdminPage')
const AppealsPage = createLazyPage('./pages/AppealsPage', 'AppealsPage')
const CalendarPage = createLazyPage('./pages/CalendarPage', 'CalendarPage')
const DiscoverPage = createLazyPage('./pages/DiscoverPage', 'DiscoverPage')
const EditEventPage = createLazyPage('./pages/EditEventPage', 'EditEventPage')
const FeedPage = createLazyPage('./pages/FeedPage', 'FeedPage')
const HomePage = createLazyPage('./pages/HomePage', 'HomePage')
const InstanceDetailPage = createLazyPage('./pages/InstanceDetailPage', 'InstanceDetailPage')
const InstancesPage = createLazyPage('./pages/InstancesPage', 'InstancesPage')
const LoginPage = createLazyPage('./pages/LoginPage', 'LoginPage')
const ModerationPracticesPage = createLazyPage(
	'./pages/ModerationPracticesPage',
	'ModerationPracticesPage'
)
const NotificationsPage = createLazyPage('./pages/NotificationsPage', 'NotificationsPage')
const OnboardingPage = createLazyPage('./pages/OnboardingPage', 'OnboardingPage')
const PendingFollowersPage = createLazyPage('./pages/PendingFollowersPage', 'PendingFollowersPage')
const PrivacyPolicyPage = createLazyPage('./pages/PrivacyPolicyPage', 'PrivacyPolicyPage')
const RemindersPage = createLazyPage('./pages/RemindersPage', 'RemindersPage')
const ReportsPage = createLazyPage('./pages/ReportsPage', 'ReportsPage')
const SettingsPage = createLazyPage('./pages/SettingsPage', 'SettingsPage')
const TemplatesPage = createLazyPage('./pages/TemplatesPage', 'TemplatesPage')
const TermsOfServicePage = createLazyPage('./pages/TermsOfServicePage', 'TermsOfServicePage')
const EventDetailPage = createLazyPage('./pages/EventDetailPage', 'EventDetailPage')
const NotFoundPage = createLazyPage('./pages/NotFoundPage', 'NotFoundPage')
const UserProfilePage = createLazyPage('./pages/UserProfilePage', 'UserProfilePage')

const publicPaths = ['/login', '/terms', '/privacy', '/about', '/onboarding']

/**
 * Smart router that determines whether to show a user profile or event detail
 * based on the URL structure:
 * - /@username -> UserProfilePage
 * - /@username/eventId -> EventDetailPage
 * - Any other path -> NotFoundPage
 */
function ProfileOrEventRouter() {
	const location = useLocation()

	// Check if path starts with /@
	if (!location.pathname.startsWith('/@')) {
		return <NotFoundPage />
	}

	// Extract path parts
	const pathParts = location.pathname.split('/').filter(Boolean)

	// If there are 2 parts (e.g., [@username, eventId]), it's an event
	if (pathParts.length >= 2) {
		return <EventDetailPage />
	}

	// Otherwise, it's a profile
	return <UserProfilePage />
}

function AppContent() {
	// Global SSE connection
	useRealtimeSSE()
	const navigate = useNavigate()
	const location = useLocation()
	const [checkingSetup, setCheckingSetup] = useState(true)
	const addToast = useUIStore((state) => state.addToast)
	const { user, loading: authLoading, tosStatus } = useAuth()

	// Determine if ToS acceptance is needed
	// Only show modal if user is authenticated, ToS status indicates acceptance is needed,
	// and we're not on a public page
	const needsTosAcceptance = useMemo(() => {
		const isPublicPath = publicPaths.some((path) => location.pathname.startsWith(path))
		return !authLoading && user !== null && tosStatus?.needsAcceptance === true && !isPublicPath
	}, [authLoading, user, tosStatus, location.pathname])

	useEffect(() => {
		// Don't check setup if we're already on the onboarding page
		if (location.pathname === '/onboarding') {
			// Use setTimeout to avoid synchronous setState in effect
			setTimeout(() => setCheckingSetup(false), 0)
			return
		}

		api.get<{ setupRequired: boolean }>('/setup/status')
			.then((data) => {
				if (data.setupRequired) {
					navigate('/onboarding')
				}
			})
			.catch((error) => logger.error('Failed to check setup status:', error))
			.finally(() => setCheckingSetup(false))
	}, [navigate, location.pathname])

	// Check for toast messages stored in sessionStorage (e.g., after redirect)
	useEffect(() => {
		const toastData = sessionStorage.getItem(TOAST_ON_LOAD_KEY)
		if (toastData) {
			try {
				const parsed = JSON.parse(toastData)

				// Validate the structure and types of the parsed data
				// Also validate message length to prevent UI issues and potential abuse
				if (
					typeof parsed === 'object' &&
					parsed !== null &&
					!Array.isArray(parsed) &&
					typeof parsed.message === 'string' &&
					parsed.message.length > 0 &&
					parsed.message.length <= MAX_MESSAGE_LENGTH &&
					typeof parsed.variant === 'string' &&
					(parsed.variant === 'error' || parsed.variant === 'success')
				) {
					addToast({
						id: generateId(),
						message: parsed.message,
						variant: parsed.variant,
					})
				} else {
					logger.error('Invalid toast data structure in sessionStorage', {
						hasMessage: typeof parsed?.message === 'string',
						messageLength:
							typeof parsed?.message === 'string' ? parsed.message.length : undefined,
						hasVariant: typeof parsed?.variant === 'string',
						variantValue: parsed?.variant,
					})
				}
			} catch (e) {
				logger.error('Failed to parse toast data from sessionStorage', e)
			} finally {
				// Always remove the item from storage, regardless of success or failure
				sessionStorage.removeItem(TOAST_ON_LOAD_KEY)
			}
		}
	}, [addToast])

	if (checkingSetup) {
		return <PageLoader />
	}

	return (
		<ErrorBoundary resetKeys={[location.pathname]}>
			<SkipLink />
			<Suspense fallback={<PageLoader />}>
				<Routes>
					<Route path="/onboarding" element={<OnboardingPage />} />
					<Route path="/" element={<HomePage />} />
					<Route path="/about" element={<AboutPage />} />
					<Route path="/appeals" element={<AppealsPage />} />
					<Route path="/reports" element={<ReportsPage />} />
					<Route path="/moderation" element={<ModerationPracticesPage />} />
					<Route path="/terms" element={<TermsOfServicePage />} />
					<Route path="/privacy" element={<PrivacyPolicyPage />} />
					<Route path="/login" element={<LoginPage />} />
					<Route path="/feed" element={<FeedPage />} />
					<Route path="/calendar" element={<CalendarPage />} />
					<Route path="/discover" element={<DiscoverPage />} />
					<Route path="/templates" element={<TemplatesPage />} />
					<Route path="/instances" element={<InstancesPage />} />
					<Route path="/instances/:domain" element={<InstanceDetailPage />} />
					<Route path="/settings" element={<SettingsPage />} />
					<Route path="/followers/pending" element={<PendingFollowersPage />} />
					<Route path="/notifications" element={<NotificationsPage />} />
					<Route path="/reminders" element={<RemindersPage />} />
					<Route path="/admin" element={<AdminPage />} />
					<Route path="/edit/*" element={<EditEventPage />} />
					<Route path="/404" element={<NotFoundPage />} />
					<Route path="/*" element={<ProfileOrEventRouter />} />
				</Routes>
			</Suspense>
			<MentionNotifications />
			<Toasts />
			<TosAcceptanceModal isOpen={needsTosAcceptance} />
			<Footer />
		</ErrorBoundary>
	)
}

function App() {
	// Configure logger based on environment
	useEffect(() => {
		configureLogger({
			minLevel: import.meta.env.DEV ? 'debug' : 'warn',
			enableInProduction: false,
		})
	}, [])

	return (
		<QueryClientProvider client={queryClient}>
			<ThemeProvider>
				<AuthProvider>
					<AppContent />
				</AuthProvider>
			</ThemeProvider>
		</QueryClientProvider>
	)
}

export default App
