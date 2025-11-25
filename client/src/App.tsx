import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { FeedPage } from './pages/FeedPage'
import { CalendarPage } from './pages/CalendarPage'
import { ProfileOrEventPage } from './pages/ProfileOrEventPage'

function App() {
    return (
        <AuthProvider>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/feed" element={<FeedPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/*" element={<ProfileOrEventPage />} />
            </Routes>
        </AuthProvider>
    )
}

export default App
