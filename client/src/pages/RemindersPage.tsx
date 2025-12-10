import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useUserReminders } from '../hooks/queries/reminders'
import { ReminderList } from '../components/ReminderList'
import { Container } from '../components/layout/Container'
import { PageLayout } from '../components/layout/PageLayout'
import { Button } from '../components/ui/Button'

export function RemindersPage() {
    const navigate = useNavigate()
    const { user, loading: authLoading } = useAuth()
    const { data, isLoading, error } = useUserReminders()

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!authLoading && !user) {
            navigate('/login')
        }
    }, [user, authLoading, navigate])

    if (authLoading || isLoading) {
        return (
            <PageLayout>
                <Container>
                    <div className="py-12 text-center">
                        <div className="text-text-secondary">Loading reminders...</div>
                    </div>
                </Container>
            </PageLayout>
        )
    }

    if (error) {
        return (
            <PageLayout>
                <Container>
                    <div className="py-12 text-center">
                        <div className="text-6xl mb-4">⚠️</div>
                        <h2 className="text-xl font-semibold text-text-primary mb-2">
                            Failed to load reminders
                        </h2>
                        <p className="text-text-secondary mb-4">
                            {error instanceof Error ? error.message : 'An error occurred'}
                        </p>
                        <Button onClick={() => window.location.reload()}>Try Again</Button>
                    </div>
                </Container>
            </PageLayout>
        )
    }

    if (!user) {
        return null
    }

    return (
        <PageLayout>
            <Container>
                <div className="py-8">
                    <div className="mb-6">
                        <h1 className="text-3xl font-bold text-text-primary mb-2">My Reminders</h1>
                        <p className="text-text-secondary">
                            Manage your event reminder notifications. You'll be notified before events start.
                        </p>
                    </div>

                    <ReminderList reminders={data?.reminders || []} />
                </div>
            </Container>
        </PageLayout>
    )
}
