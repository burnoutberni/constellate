import { Container } from '@/components/layout'
import { Card, CardContent, CardTitle } from '@/components/ui'

import { Navbar } from '../components/Navbar'
import { useAuth } from '../hooks/useAuth'

export function TermsOfServicePage() {
	const { user, logout } = useAuth()

	return (
		<div className="min-h-screen bg-background-secondary">
			<Navbar isConnected={false} user={user} onLogout={logout} />
			<Container className="py-8" size="lg">
				<h1 className="text-3xl font-bold text-text-primary mb-8">Terms of Service</h1>
				<Card>
					<CardContent className="space-y-4">
						<CardTitle>1. Acceptance of Terms</CardTitle>
						<p className="text-text-secondary">
							By accessing and using this service, you accept and agree to be bound by
							the terms and provision of this agreement.
						</p>

						<CardTitle className="mt-6">2. User Conduct</CardTitle>
						<p className="text-text-secondary">
							You agree to use the service only for lawful purposes. You are
							prohibited from posting content that is illegal, offensive, or violates
							the rights of others.
						</p>

						<CardTitle className="mt-6">3. Content Ownership</CardTitle>
						<p className="text-text-secondary">
							You retain ownership of the content you create. By posting content, you
							grant us a license to display and distribute it within the federated
							network.
						</p>

						<CardTitle className="mt-6">4. Termination</CardTitle>
						<p className="text-text-secondary">
							We reserve the right to terminate or suspend your account if you violate
							these terms.
						</p>
					</CardContent>
				</Card>
			</Container>
		</div>
	)
}
