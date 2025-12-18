import { Container } from '@/components/layout'
import { Card, CardContent, CardTitle } from '@/components/ui'

import { Navbar } from '../components/Navbar'
import { useAuth } from '../hooks/useAuth'

export function PrivacyPolicyPage() {
	const { user, logout } = useAuth()

	return (
		<div className="min-h-screen bg-background-secondary">
			<Navbar isConnected={false} user={user} onLogout={logout} />
			<Container className="py-8" size="lg">
				<h1 className="text-3xl font-bold text-text-primary mb-8">Privacy Policy</h1>
				<Card>
					<CardContent className="space-y-4">
						<CardTitle>Data Collection</CardTitle>
						<p className="text-text-secondary">
							We collect only the information necessary to provide the service, such
							as your username, email (for local accounts), and the content you post.
						</p>

						<CardTitle className="mt-6">Data Usage</CardTitle>
						<p className="text-text-secondary">
							Your data is used to display your profile and events to other users.
							Public content is shared with other instances in the fediverse.
						</p>

						<CardTitle className="mt-6">Your Rights</CardTitle>
						<p className="text-text-secondary">
							You have the right to access, correct, or delete your data at any time.
							You can export your data from the settings page.
						</p>

						<CardTitle className="mt-6">Cookies</CardTitle>
						<p className="text-text-secondary">
							We use cookies solely for authentication and session management. No
							third-party tracking cookies are used.
						</p>
					</CardContent>
				</Card>
			</Container>
		</div>
	)
}
