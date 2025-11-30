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

function AppContent() {
    // Global SSE connection
    useRealtimeSSE()

    return (
        <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/feed" element={<FeedPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/settings" element={<SettingsPage />} />
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
