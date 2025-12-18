import { Link } from 'react-router-dom'

import { Card } from '@/components/ui'

export function AboutPage() {
	return (
		<div className="min-h-screen bg-background-secondary">
			{/* Hero Section */}
			<div className="bg-background-primary border-b border-border-default">
				<div className="max-w-4xl mx-auto px-4 py-16 text-center">
					<h1 className="text-5xl font-bold text-text-primary mb-4">Constellate</h1>
					<p className="text-xl text-text-secondary mb-8">
						Open source, federated event management for the fediverse
					</p>
					<div className="flex gap-4 justify-center">
						<Link
							to="/login"
							className="inline-flex items-center justify-center px-8 py-3 text-lg font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors">
							Get Started
						</Link>
						<a
							href="https://github.com"
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center justify-center px-8 py-3 text-lg font-medium text-text-primary bg-background-primary border border-border-default rounded-lg hover:bg-background-secondary transition-colors">
							View on GitHub
						</a>
					</div>
				</div>
			</div>

			{/* Main Content */}
			<div className="max-w-4xl mx-auto px-4 py-16 space-y-12">
				{/* Open Source */}
				<section>
					<h2 className="text-3xl font-bold text-text-primary mb-4">Open Source</h2>
					<p className="text-lg text-text-secondary leading-relaxed">
						Constellate is built with open source principles at its core. We believe
						that event management should be decentralized, transparent, and accessible
						to everyone. The codebase is freely available, allowing communities to run
						their own instances and contribute to the project.
					</p>
				</section>

				{/* Federation */}
				<section>
					<h2 className="text-3xl font-bold text-text-primary mb-4">
						The Power of Federation
					</h2>
					<p className="text-lg text-text-secondary leading-relaxed mb-4">
						Federation enables a truly interconnected network of independent servers.
						Unlike centralized platforms, federated systems give you:
					</p>
					<ul className="space-y-3 text-lg text-text-secondary">
						<li className="flex items-start gap-3">
							<span className="text-2xl">🌐</span>
							<span>
								<strong className="text-text-primary">Freedom:</strong> Choose your
								own server or run your own instance
							</span>
						</li>
						<li className="flex items-start gap-3">
							<span className="text-2xl">🔗</span>
							<span>
								<strong className="text-text-primary">Interoperability:</strong>{' '}
								Connect with users across different servers using ActivityPub
							</span>
						</li>
						<li className="flex items-start gap-3">
							<span className="text-2xl">🛡️</span>
							<span>
								<strong className="text-text-primary">Resilience:</strong> No single
								point of failure - the network survives even if one server goes down
							</span>
						</li>
						<li className="flex items-start gap-3">
							<span className="text-2xl">👥</span>
							<span>
								<strong className="text-text-primary">Community:</strong> Each
								server is owned and operated by its community
							</span>
						</li>
					</ul>
				</section>

				{/* Features */}
				<section>
					<h2 className="text-3xl font-bold text-text-primary mb-6">Features</h2>
					<div className="grid md:grid-cols-2 gap-6">
						<Card padding="lg">
							<div className="text-4xl mb-4">⚡</div>
							<h3 className="text-xl font-semibold mb-2 text-text-primary">
								Real-time Updates
							</h3>
							<p className="text-text-secondary">
								Live synchronization with Server-Sent Events for instant updates
								across the network
							</p>
						</Card>

						<Card padding="lg">
							<div className="text-4xl mb-4">📅</div>
							<h3 className="text-xl font-semibold mb-2 text-text-primary">
								Event Management
							</h3>
							<p className="text-text-secondary">
								Create, share, and discover events with RSVP, comments, and social
								features
							</p>
						</Card>

						<Card padding="lg">
							<div className="text-4xl mb-4">🌍</div>
							<h3 className="text-xl font-semibold mb-2 text-text-primary">
								ActivityPub
							</h3>
							<p className="text-text-secondary">
								Built on the ActivityPub protocol, connecting with the wider
								fediverse
							</p>
						</Card>

						<Card padding="lg">
							<div className="text-4xl mb-4">🔒</div>
							<h3 className="text-xl font-semibold mb-2 text-text-primary">
								Privacy First
							</h3>
							<p className="text-text-secondary">
								Your data stays on your server. No tracking, no ads, no surveillance
							</p>
						</Card>
					</div>
				</section>

				{/* CTA */}
				<section className="text-center py-8">
					<Link
						to="/"
						className="inline-flex items-center justify-center px-8 py-3 text-lg font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors">
						View Public Events
					</Link>
				</section>
			</div>
		</div>
	)
}
