import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'

import { ErrorBoundary } from './components/ErrorBoundary'
import { MentionNotifications } from './components/MentionNotifications'
import { Toasts } from './components/Toast'
import { PageLoader } from './components/ui'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './design-system'
import { useRealtimeSSE } from './hooks/useRealtimeSSE'
import { api } from './lib/api-client'
import { logger, configureLogger } from './lib/logger'
import { queryClient } from './lib/queryClient'
import { AboutPage } from './pages/AboutPage'
import { AdminPage } from './pages/AdminPage'
import { CalendarPage } from './pages/CalendarPage'
import { EditEventPage } from './pages/EditEventPage'
import { EventDiscoveryPage } from './pages/EventDiscoveryPage'
import { FeedPage } from './pages/FeedPage'
import { HomePage } from './pages/HomePage'
import { InstanceDetailPage } from './pages/InstanceDetailPage'
import { InstancesPage } from './pages/InstancesPage'
import { LoginPage } from './pages/LoginPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { PendingFollowersPage } from './pages/PendingFollowersPage'
import { ProfileOrEventPage } from './pages/ProfileOrEventPage'
import { RemindersPage } from './pages/RemindersPage'
import { SearchPage } from './pages/SearchPage'
import { SettingsPage } from './pages/SettingsPage'
import { TemplatesPage } from './pages/TemplatesPage'
import { useUIStore } from './stores'

function AppContent() {
	// Global SSE connection
	useRealtimeSSE()
	const navigate = useNavigate()
	const location = useLocation()
	const [checkingSetup, setCheckingSetup] = useState(true)
	const addToast = useUIStore((state) => state.addToast)

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
		const toastData = sessionStorage.getItem('toastOnLoad')
		if (toastData) {
			try {
				const { message, variant } = JSON.parse(toastData)
				addToast({ id: crypto.randomUUID(), message, variant })
				sessionStorage.removeItem('toastOnLoad')
			} catch (e) {
				console.error('Failed to parse toast data from sessionStorage', e)
				sessionStorage.removeItem('toastOnLoad')
			}
		}
	}, [addToast])

	if (checkingSetup) {
		return <PageLoader />
	}

	return (
		<ErrorBoundary resetKeys={[location.pathname]}>
			<Routes>
				<Route path="/onboarding" element={<OnboardingPage />} />
				<Route path="/" element={<HomePage />} />
				<Route path="/about" element={<AboutPage />} />
				<Route path="/login" element={<LoginPage />} />
				<Route path="/feed" element={<FeedPage />} />
				<Route path="/calendar" element={<CalendarPage />} />
				<Route path="/search" element={<SearchPage />} />
				<Route path="/events" element={<EventDiscoveryPage />} />
				<Route path="/templates" element={<TemplatesPage />} />
				<Route path="/instances" element={<InstancesPage />} />
				<Route path="/instances/:domain" element={<InstanceDetailPage />} />
				<Route path="/settings" element={<SettingsPage />} />
				<Route path="/followers/pending" element={<PendingFollowersPage />} />
				<Route path="/notifications" element={<NotificationsPage />} />
				<Route path="/reminders" element={<RemindersPage />} />
				<Route path="/admin" element={<AdminPage />} />
				<Route path="/edit/*" element={<EditEventPage />} />
				<Route path="/*" element={<ProfileOrEventPage />} />
			</Routes>
			<MentionNotifications />
			<Toasts />
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
