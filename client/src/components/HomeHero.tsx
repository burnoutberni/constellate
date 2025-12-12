import { Link } from 'react-router-dom'
import { Button } from './ui'
import { Section, Stack } from './layout'

interface HomeHeroProps {
	/**
	 * Whether the user is authenticated
	 */
	isAuthenticated: boolean
}

/**
 * HomeHero component - Hero section for the homepage
 * Explains the platform and provides clear CTAs
 */
export function HomeHero({ isAuthenticated }: HomeHeroProps) {
	return (
		<Section
			as="header"
			variant="accent"
			padding="xl"
			className="border-b border-border-default">
			<div className="text-center space-y-6">
				{/* Hero Title */}
				<div className="space-y-3">
					<h1 className="text-5xl sm:text-6xl font-bold text-text-primary tracking-tight">
						Discover Events in the{' '}
						<span className="text-primary-600 dark:text-primary-400">Fediverse</span>
					</h1>
					<p className="text-xl sm:text-2xl text-text-secondary max-w-3xl mx-auto">
						A federated event platform built on ActivityPub. Create, discover, and
						attend events across the decentralized web.
					</p>
				</div>

				{/* Features */}
				<div className="flex flex-wrap justify-center gap-4 text-sm sm:text-base text-text-secondary">
					<div className="flex items-center gap-2">
						<span className="text-2xl" role="img" aria-label="Calendar">
							📅
						</span>
						<span>Public Events</span>
					</div>
					<div className="flex items-center gap-2">
						<span className="text-2xl" role="img" aria-label="Globe">
							🌐
						</span>
						<span>Federated Network</span>
					</div>
					<div className="flex items-center gap-2">
						<span className="text-2xl" role="img" aria-label="People">
							👥
						</span>
						<span>Community Driven</span>
					</div>
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
				{!isAuthenticated && (
					<div className="pt-2">
						<Link
							to="/about"
							className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
							Learn more about federation →
						</Link>
					</div>
				)}
			</div>
		</Section>
	)
}
