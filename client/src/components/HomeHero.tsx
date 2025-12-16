import { Link } from 'react-router-dom'

import { Container, Stack } from './layout'
import { Button, Badge } from './ui'

interface HomeHeroProps {
	isAuthenticated: boolean
}

/**
 * HomeHero component - Hero section for the homepage
 * Explains the platform and provides clear CTAs with a modern design.
 */
export function HomeHero({ isAuthenticated }: HomeHeroProps) {
	return (
		<div className="relative overflow-hidden bg-background-primary border-b border-border-default">
			{/* Abstract Background Pattern */}
			<div className="absolute inset-0 z-0 opacity-30 dark:opacity-20 pointer-events-none">
				<div className="absolute -top-24 -right-24 w-96 h-96 bg-primary-100 dark:bg-primary-900/40 rounded-full blur-3xl" />
				<div className="absolute top-1/2 -left-24 w-64 h-64 bg-secondary-100 dark:bg-secondary-900/40 rounded-full blur-3xl" />
			</div>

			<Container className="relative z-10 py-16 md:py-24">
				<div className="max-w-3xl mx-auto text-center space-y-8">
					{/* Badge */}
					<div className="animate-fade-in">
						<Badge variant="primary" rounded className="px-4 py-1.5 text-sm shadow-sm">
							✨ The Future of Event Discovery
						</Badge>
					</div>

					{/* Hero Title */}
					<div className="space-y-4 animate-slide-up">
						<h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold text-text-primary tracking-tight leading-[1.1]">
							Connect Across the <br />
							<span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-secondary-600 dark:from-primary-400 dark:to-secondary-400">
								Fediverse
							</span>
						</h1>
						<p className="text-xl sm:text-2xl text-text-secondary max-w-2xl mx-auto leading-relaxed">
							Create, discover, and join events without borders.{' '}
							<br className="hidden sm:block" />
							Constellate is your gateway to the decentralized social web.
						</p>
					</div>

					{/* CTAs */}
					<Stack
						direction="column"
						directionSm="row"
						gap="md"
						justify="center"
						align="center"
						className="pt-4 animate-scale-in">
						{!isAuthenticated ? (
							<>
								<Link to="/login?signup=true" className="w-full sm:w-auto">
									<Button
										variant="primary"
										size="lg"
										fullWidth
										className="shadow-lg hover:shadow-xl shadow-primary-500/20">
										Get Started
									</Button>
								</Link>
								<Link to="/discover" className="w-full sm:w-auto">
									<Button variant="secondary" size="lg" fullWidth>
										Browse Events
									</Button>
								</Link>
							</>
						) : (
							<>
								<Link to="/feed" className="w-full sm:w-auto">
									<Button
										variant="primary"
										size="lg"
										fullWidth
										className="shadow-lg hover:shadow-xl shadow-primary-500/20">
										Go to Feed
									</Button>
								</Link>
								<Link to="/discover" className="w-full sm:w-auto">
									<Button variant="secondary" size="lg" fullWidth>
										Explore
									</Button>
								</Link>
							</>
						)}
					</Stack>

					{/* Trust/Social Proof */}
					<div className="pt-8 flex items-center justify-center gap-8 text-text-tertiary text-sm font-medium animate-fade-in opacity-0 [animation-delay:200ms] [animation-fill-mode:forwards]">
						<div className="flex items-center gap-2">
							<span className="text-xl">🌐</span> Federated (ActivityPub)
						</div>
						<div className="flex items-center gap-2">
							<span className="text-xl">🔓</span> Open Source
						</div>
						<div className="flex items-center gap-2">
							<span className="text-xl">🏠</span> Self-Hostable
						</div>
					</div>
				</div>
			</Container>
		</div>
	)
}
