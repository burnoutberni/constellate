import { Link } from 'react-router-dom'

import { Section, Stack } from './layout'
import { Button } from './ui'

interface HomeHeroProps {
	/**
	 * Whether the user is authenticated
	 */
	isAuthenticated: boolean
}

/**
 * HomeHero component - Hero section for the homepage
 * Explains the platform and provides clear CTAs
 * Features self-hosting information and federation messaging
 */
export function HomeHero({ isAuthenticated }: HomeHeroProps) {
	return (
		<Section
			as="header"
			variant="accent"
			padding="xl"
			className="border-b border-border-default">
			<div className="text-center space-y-8">
				{/* Hero Title */}
				<div className="space-y-4">
					<h1 className="text-5xl sm:text-6xl font-bold text-text-primary tracking-tight">
						Discover Events in the{' '}
						<span className="text-primary-600 dark:text-primary-400">Fediverse</span>
					</h1>
					<p className="text-xl sm:text-2xl text-text-secondary max-w-3xl mx-auto">
						Constellate is a federated event platform built on ActivityPub. Create,
						discover, and attend events across the decentralized web.
					</p>
				</div>

				{/* Key Features */}
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
					<div className="p-4 rounded-lg bg-background-secondary/50">
						<div className="text-3xl mb-2">📅</div>
						<h3 className="font-semibold text-text-primary mb-1">Event Management</h3>
						<p className="text-sm text-text-secondary">
							Create, manage, and share events
						</p>
					</div>
					<div className="p-4 rounded-lg bg-background-secondary/50">
						<div className="text-3xl mb-2">🌐</div>
						<h3 className="font-semibold text-text-primary mb-1">Federated Network</h3>
						<p className="text-sm text-text-secondary">
							Connect with events across servers
						</p>
					</div>
					<div className="p-4 rounded-lg bg-background-secondary/50">
						<div className="text-3xl mb-2">🔐</div>
						<h3 className="font-semibold text-text-primary mb-1">Self-Hosted</h3>
						<p className="text-sm text-text-secondary">
							Run your own instance, own your data
						</p>
					</div>
				</div>

				{/* Self-hosting callout */}
				<div className="max-w-2xl mx-auto p-4 rounded-lg border border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-900/10">
					<p className="text-sm text-text-secondary">
						<span className="font-semibold text-text-primary">
							Self-hosting available:
						</span>{' '}
						Want to run Constellate on your own infrastructure? Learn about{' '}
						<Link
							to="/about"
							className="text-primary-600 dark:text-primary-400 hover:underline font-medium">
							self-hosting options
						</Link>
						.
					</p>
				</div>

				{/* CTAs */}
				<Stack
					direction="column"
					directionSm="row"
					gap="md"
					justify="center"
					align="center"
					className="pt-4">
					{!isAuthenticated ? (
						<>
							<Link to="/login">
								<Button variant="primary" size="lg">
									Sign Up Free
								</Button>
							</Link>
							<Link to="/search">
								<Button variant="secondary" size="lg">
									Browse Events
								</Button>
							</Link>
						</>
					) : (
						<>
							<Link to="/feed">
								<Button variant="primary" size="lg">
									View Your Feed
								</Button>
							</Link>
							<Link to="/search">
								<Button variant="secondary" size="lg">
									Discover Events
								</Button>
							</Link>
						</>
					)}
				</Stack>

				{/* Learn More Link */}
				<div className="pt-2 flex justify-center gap-4 flex-wrap text-sm">
					<Link
						to="/about"
						className="text-primary-600 dark:text-primary-400 hover:underline">
						Learn more about federation →
					</Link>
					<span className="text-text-tertiary">•</span>
					<Link
						to="/about"
						className="text-primary-600 dark:text-primary-400 hover:underline">
						Deployment guide →
					</Link>
				</div>
			</div>
		</Section>
	)
}
