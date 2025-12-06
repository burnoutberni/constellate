import { Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { AuthProvider } from './contexts/AuthContext'
import { useRealtimeSSE } from './hooks/useRealtimeSSE'
import { HomePage } from './pages/HomePage'
import { AboutPage } from './pages/AboutPage'
import { LoginPage } from './pages/LoginPage'
import { FeedPage } from './pages/FeedPage'
import { CalendarPage } from './pages/CalendarPage'
import { ProfileOrEventPage } from './pages/ProfileOrEventPage'
import { SettingsPage } from './pages/SettingsPage'
import { PendingFollowersPage } from './pages/PendingFollowersPage'
import { AdminPage } from './pages/AdminPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

function AppContent() {
    // Global SSE connection
    useRealtimeSSE()
    const navigate = useNavigate()
    const location = useLocation()
    const [checkingSetup, setCheckingSetup] = useState(true)

    useEffect(() => {
        // Don't check setup if we're already on the onboarding page
        if (location.pathname === '/onboarding') {
            setCheckingSetup(false)
            return
        }

        fetch('/api/setup/status')
            .then(res => res.json())
            .then(data => {
                if (data.setupRequired) {
                    navigate('/onboarding')
                }
            })
            .catch(console.error)
            .finally(() => setCheckingSetup(false))
    }, [navigate, location.pathname])

    if (checkingSetup) {
        return <div className="min-h-screen flex items-center justify-center">Loading...</div>
    }

    return (
        <Routes>
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/feed" element={<FeedPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/followers/pending" element={<PendingFollowersPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/*" element={<ProfileOrEventPage />} />
        </Routes>
    )
}

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <AppContent />
            </AuthProvider>
        </QueryClientProvider>
    )
}

export default App
