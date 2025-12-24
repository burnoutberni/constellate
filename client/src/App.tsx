import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState, useMemo, lazy, Suspense, type ReactNode } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'

import { useCurrentUserProfile } from '@/hooks/queries'

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

// Lazy load pages
const AboutPage = lazy(() =>
	import('./pages/AboutPage').then((module) => ({ default: module.AboutPage }))
)
const AdminPage = lazy(() =>
	import('./pages/AdminPage').then((module) => ({ default: module.AdminPage }))
)
const AppealsPage = lazy(() =>
	import('./pages/AppealsPage').then((module) => ({ default: module.AppealsPage }))
)
const CalendarPage = lazy(() =>
	import('./pages/CalendarPage').then((module) => ({ default: module.CalendarPage }))
)
const DiscoverPage = lazy(() =>
	import('./pages/DiscoverPage').then((module) => ({ default: module.DiscoverPage }))
)
const EditEventPage = lazy(() =>
	import('./pages/EditEventPage').then((module) => ({ default: module.EditEventPage }))
)
const FeedPage = lazy(() =>
	import('./pages/FeedPage').then((module) => ({ default: module.FeedPage }))
)
const HomePage = lazy(() =>
	import('./pages/HomePage').then((module) => ({ default: module.HomePage }))
)
const InstanceDetailPage = lazy(() =>
	import('./pages/InstanceDetailPage').then((module) => ({ default: module.InstanceDetailPage }))
)
const InstancesPage = lazy(() =>
	import('./pages/InstancesPage').then((module) => ({ default: module.InstancesPage }))
)
const LoginPage = lazy(() =>
	import('./pages/LoginPage').then((module) => ({ default: module.LoginPage }))
)
const ModerationPracticesPage = lazy(() =>
	import('./pages/ModerationPracticesPage').then((module) => ({
		default: module.ModerationPracticesPage,
	}))
)
const NotificationsPage = lazy(() =>
	import('./pages/NotificationsPage').then((module) => ({ default: module.NotificationsPage }))
)
const OnboardingPage = lazy(() =>
	import('./pages/OnboardingPage').then((module) => ({ default: module.OnboardingPage }))
)
const PendingFollowersPage = lazy(() =>
	import('./pages/PendingFollowersPage').then((module) => ({
		default: module.PendingFollowersPage,
	}))
)
const PrivacyPolicyPage = lazy(() =>
	import('./pages/PrivacyPolicyPage').then((module) => ({ default: module.PrivacyPolicyPage }))
)
const RemindersPage = lazy(() =>
	import('./pages/RemindersPage').then((module) => ({ default: module.RemindersPage }))
)
const ReportsPage = lazy(() =>
	import('./pages/ReportsPage').then((module) => ({ default: module.ReportsPage }))
)
const SettingsPage = lazy(() =>
	import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage }))
)
const TemplatesPage = lazy(() =>
	import('./pages/TemplatesPage').then((module) => ({ default: module.TemplatesPage }))
)
const TermsOfServicePage = lazy(() =>
	import('./pages/TermsOfServicePage').then((module) => ({ default: module.TermsOfServicePage }))
)
const EventDetailPage = lazy(() =>
	import('./pages/EventDetailPage').then((module) => ({ default: module.EventDetailPage }))
)
const NotFoundPage = lazy(() =>
	import('./pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage }))
)
const UserProfilePage = lazy(() =>
	import('./pages/UserProfilePage').then((module) => ({ default: module.UserProfilePage }))
)

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

	// Extract path parts (filter out empty strings)
	const pathParts = location.pathname.split('/').filter(Boolean)

	// If there are exactly 2 parts (e.g., [@username, eventId]), it's an event
	if (pathParts.length === 2) {
		return <EventDetailPage />
	}

	// If there's exactly 1 part and it's not just '@', it's a profile
	// Paths like /@ or /@/ will have pathParts.length === 1 with pathParts[0] === '@'
	if (pathParts.length === 1 && pathParts[0] !== '@') {
		return <UserProfilePage />
	}

	// All other cases (empty path, just /@, more than 2 parts, etc.) -> 404
	return <NotFoundPage />
}

function ThemeWrapper({ children }: { children: ReactNode }) {
	const { user } = useAuth()
	const { data: profile } = useCurrentUserProfile(user?.id)

	return (
		<ThemeProvider key={profile?.theme ?? 'system'} userTheme={profile?.theme ?? null}>
			{children}
		</ThemeProvider>
	)
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
			<AuthProvider>
				<ThemeWrapper>
					<AppContent />
				</ThemeWrapper>
			</AuthProvider>
		</QueryClientProvider>
	)
}

export default App
