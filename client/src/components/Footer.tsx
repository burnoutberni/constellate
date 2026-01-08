import { Link } from 'react-router-dom'

import { Container } from './layout'

interface FooterLink {
	to: string
	label: string
}

interface FooterSection {
	title: string
	links: FooterLink[]
}

const footerSections: FooterSection[] = [
	{
		title: 'Platform',
		links: [
			{ to: '/discover', label: 'Discover' },
			{ to: '/instances', label: 'Instances' },
			{ to: '/about', label: 'About' },
			{ to: '/moderation', label: 'Moderation' },
		],
	},
	{
		title: 'Legal',
		links: [
			{ to: '/terms', label: 'Terms of Service' },
			{ to: '/privacy', label: 'Privacy Policy' },
		],
	},
]

export function Footer() {
	const currentYear = new Date().getFullYear()

	return (
		<footer className="bg-background-primary border-t border-border-default mt-auto">
			<Container className="py-8">
				<div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
					<div className="col-span-1 md:col-span-2">
						<Link
							to="/"
							className="text-xl font-bold text-primary-600 mb-4 inline-block">
							Constellate
						</Link>
						<p className="text-text-secondary max-w-sm">
							Open source, federated event management for everyone. Connect, share,
							and discover events across the decentralized web.
						</p>
					</div>

					{footerSections.map((section) => (
						<div key={section.title}>
							<h3 className="font-semibold text-text-primary mb-4">
								{section.title}
							</h3>
							<ul className="space-y-2">
								{section.links.map((link) => (
									<li key={link.to}>
										<Link
											to={link.to}
											className="text-text-secondary hover:text-primary-600 transition-colors">
											{link.label}
										</Link>
									</li>
								))}
							</ul>
						</div>
					))}
				</div>

				<div className="pt-8 border-t border-border-default flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-text-tertiary">
					<p>© {currentYear} Constellate. All rights reserved.</p>
					<div className="flex gap-6">
						<a
							href="https://github.com/burnoutberni/constellate"
							target="_blank"
							rel="noopener noreferrer"
							className="hover:text-text-primary transition-colors">
							GitHub
						</a>
						{/* Add more social links as needed */}
					</div>
				</div>
			</Container>
		</footer>
	)
}
