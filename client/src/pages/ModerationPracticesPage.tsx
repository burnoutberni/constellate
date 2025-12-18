import { Container } from '@/components/layout'
import { Card, CardContent, CardTitle } from '@/components/ui'

import { Navbar } from '../components/Navbar'
import { useAuth } from '../hooks/useAuth'

export function ModerationPracticesPage() {
	const { user, logout } = useAuth()

	return (
		<div className="min-h-screen bg-background-secondary">
			<Navbar isConnected={false} user={user} onLogout={logout} />
			<Container className="py-8" size="lg">
				<h1 className="text-3xl font-bold text-text-primary mb-8">Moderation Practices</h1>

				<div className="space-y-6">
					<Card>
						<CardContent className="space-y-4">
							<CardTitle>Our Approach to Safety</CardTitle>
							<p className="text-text-secondary">
								We are committed to creating a safe and welcoming environment for
								everyone. Our moderation practices are designed to balance freedom
								of expression with the need to prevent harm.
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardContent className="space-y-4">
							<CardTitle>Prohibited Content</CardTitle>
							<ul className="list-disc pl-5 space-y-2 text-text-secondary">
								<li>Hate speech and harassment</li>
								<li>Illegal content or activities</li>
								<li>Spam and malicious content</li>
								<li>Violent or graphic content without appropriate warnings</li>
								<li>Doxing or sharing private information without consent</li>
							</ul>
						</CardContent>
					</Card>

					<Card>
						<CardContent className="space-y-4">
							<CardTitle>Reporting Process</CardTitle>
							<p className="text-text-secondary">
								If you encounter content that violates our guidelines, please use
								the report button available on events, profiles, and comments. Our
								moderation team reviews reports in the order they are received.
							</p>
							<p className="text-text-secondary">
								We aim to review all reports within 24 hours. Actions taken may
								include warning the user, hiding the content, or suspending the
								account.
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardContent className="space-y-4">
							<CardTitle>Appeals</CardTitle>
							<p className="text-text-secondary">
								If you believe a moderation decision was made in error, you have the
								right to appeal. You can submit an appeal through your user
								dashboard or by contacting support directly.
							</p>
						</CardContent>
					</Card>
				</div>
			</Container>
		</div>
	)
}
