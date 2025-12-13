import { Link, useLocation } from 'react-router-dom'

import { cn } from '@/lib/utils'

export interface BreadcrumbItem {
	label: string
	href?: string
}

interface BreadcrumbsProps {
	items?: BreadcrumbItem[]
	className?: string
}

/**
 * Breadcrumbs component for deep navigation.
 * Automatically generates breadcrumbs from the current route if items are not provided.
 * Fully accessible with ARIA labels and keyboard navigation.
 */
export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
	const location = useLocation()

	// Auto-generate breadcrumbs from route if not provided
	const breadcrumbItems = items || generateBreadcrumbsFromRoute(location.pathname)

	if (breadcrumbItems.length === 0) {
		return null
	}

	return (
		<nav
			aria-label="Breadcrumb navigation"
			className={cn('flex items-center gap-2 text-sm', className)}>
			<ol className="flex items-center gap-2" role="list">
				{breadcrumbItems.map((item, index) => {
					const isLast = index === breadcrumbItems.length - 1
					const isFirst = index === 0
					const key = item.href || `${item.label}-${index}`

					return (
						<li key={key} className="flex items-center gap-2">
							{!isFirst && (
								<span
									className="text-text-tertiary"
									aria-hidden="true"
									role="separator">
									/
								</span>
							)}
							{isLast ? (
								<span
									className="text-text-primary font-medium"
									aria-current="page">
									{item.label}
								</span>
							) : item.href ? (
								<Link
									to={item.href}
									className="text-text-link hover:text-text-link-hover transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 rounded">
									{item.label}
								</Link>
							) : (
								<span className="text-text-secondary">{item.label}</span>
							)}
						</li>
					)
				})}
			</ol>
		</nav>
	)
}

/**
 * Generates breadcrumb items from a route path
 */
function generateBreadcrumbsFromRoute(pathname: string): BreadcrumbItem[] {
	const items: BreadcrumbItem[] = []

	// Always start with Home
	items.push({ label: 'Home', href: '/' })

	// Skip root path
	if (pathname === '/') {
		return items
	}

	const pathParts = pathname.split('/').filter(Boolean)

	// Handle special routes
	if (pathParts[0] === 'feed') {
		items.push({ label: 'Feed', href: '/feed' })
		return items
	}

	if (pathParts[0] === 'calendar') {
		items.push({ label: 'Calendar', href: '/calendar' })
		return items
	}

	if (pathParts[0] === 'search') {
		items.push({ label: 'Search', href: '/search' })
		return items
	}

	if (pathParts[0] === 'events') {
		items.push({ label: 'Events', href: '/events' })
		return items
	}

	if (pathParts[0] === 'templates') {
		items.push({ label: 'Templates', href: '/templates' })
		return items
	}

	if (pathParts[0] === 'instances') {
		items.push({ label: 'Instances', href: '/instances' })
		if (pathParts[1]) {
			items.push({ label: pathParts[1] })
		}
		return items
	}

	if (pathParts[0] === 'settings') {
		items.push({ label: 'Settings', href: '/settings' })
		return items
	}

	if (pathParts[0] === 'notifications') {
		items.push({ label: 'Notifications', href: '/notifications' })
		return items
	}

	if (pathParts[0] === 'reminders') {
		items.push({ label: 'Reminders', href: '/reminders' })
		return items
	}

	if (pathParts[0] === 'admin') {
		items.push({ label: 'Admin', href: '/admin' })
		return items
	}

	if (pathParts[0] === 'about') {
		items.push({ label: 'About', href: '/about' })
		return items
	}

	if (pathParts[0] === 'followers' && pathParts[1] === 'pending') {
		items.push({ label: 'Pending Followers', href: '/followers/pending' })
		return items
	}

	// Handle profile routes (@username)
	if (pathParts[0]?.startsWith('@')) {
		const username = pathParts[0].slice(1)
		items.push({ label: `@${username}`, href: `/${pathParts[0]}` })

		// If there's a second part, it's an event
		if (pathParts[1]) {
			items.push({ label: 'Event' })
		}
		return items
	}

	// Handle edit routes
	if (pathParts[0] === 'edit') {
		items.push({ label: 'Edit Event', href: '/edit' })
		return items
	}

	// Fallback: use path parts as labels
	if (pathParts.length > 0) {
		pathParts.forEach((part, index) => {
			const href = `/${pathParts.slice(0, index + 1).join('/')}`
			items.push({ label: part, href })
		})
	}

	return items
}

