import { Link } from 'react-router-dom'

import { Container } from '@/components/layout'

export function Footer() {
	return (
		<footer className="bg-background-primary border-t border-border-default py-8 mt-auto">
			<Container>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
					<div>
						<h3 className="font-bold text-text-primary mb-4">Constellate</h3>
						<p className="text-sm text-text-secondary">
							Open source, federated event management for the modern web.
						</p>
					</div>
					<div>
						<h4 className="font-semibold text-text-primary mb-3">Community</h4>
						<ul className="space-y-2 text-sm text-text-secondary">
							<li>
								<Link
									to="/about"
									className="hover:text-primary-600 transition-colors">
									About
								</Link>
							</li>
							<li>
								<Link
									to="/moderation"
									className="hover:text-primary-600 transition-colors">
									Moderation Practices
								</Link>
							</li>
							<li>
								<a
									href="https://github.com"
									target="_blank"
									rel="noopener noreferrer"
									className="hover:text-primary-600 transition-colors">
									Source Code
								</a>
							</li>
						</ul>
					</div>
					<div>
						<h4 className="font-semibold text-text-primary mb-3">Legal</h4>
						<ul className="space-y-2 text-sm text-text-secondary">
							<li>
								<Link
									to="/terms"
									className="hover:text-primary-600 transition-colors">
									Terms of Service
								</Link>
							</li>
							<li>
								<Link
									to="/privacy"
									className="hover:text-primary-600 transition-colors">
									Privacy Policy
								</Link>
							</li>
						</ul>
					</div>
				</div>
				<div className="border-t border-border-default mt-8 pt-8 text-center text-xs text-text-tertiary">
					© {new Date().getFullYear()} Constellate. Powered by ActivityPub.
				</div>
			</Container>
		</footer>
	)
}
