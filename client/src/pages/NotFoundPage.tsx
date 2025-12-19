import { useEffect } from 'react'
import { Link } from 'react-router-dom'

import { Container } from '@/components/layout'
import { Button } from '@/components/ui'
import { setSEOMetadata } from '@/lib/seo'

export function NotFoundPage() {
	useEffect(() => {
		setSEOMetadata({
			title: 'Page Not Found',
			description: 'The page you are looking for does not exist.',
		})
	}, [])

	return (
		<div className="min-h-screen bg-background-secondary flex items-center justify-center">
			<Container size="sm" className="text-center py-16">
				<div className="mb-8 text-9xl">🔭</div>
				<h1 className="text-4xl font-bold text-text-primary mb-4">Page Not Found</h1>
				<p className="text-lg text-text-secondary mb-8">
					We looked everywhere, but we couldn&apos;t find the page you&apos;re looking
					for. It might have been moved or deleted.
				</p>
				<div className="flex gap-4 justify-center">
					<Link to="/">
						<Button variant="primary" size="lg">
							Go Home
						</Button>
					</Link>
					<Link to="/discover">
						<Button variant="secondary" size="lg">
							Discover Events
						</Button>
					</Link>
				</div>
			</Container>
		</div>
	)
}
