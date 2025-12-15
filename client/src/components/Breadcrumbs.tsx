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
								<span className="text-text-primary font-medium" aria-current="page">
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
 * Route configuration for simple routes that map directly to breadcrumb labels
 */
const ROUTE_CONFIG: Record<string, { label: string; href: string }> = {
	feed: { label: 'Feed', href: '/feed' },
	calendar: { label: 'Calendar', href: '/calendar' },
	search: { label: 'Search', href: '/search' },
	events: { label: 'Events', href: '/events' },
	templates: { label: 'Templates', href: '/templates' },
	settings: { label: 'Settings', href: '/settings' },
	notifications: { label: 'Notifications', href: '/notifications' },
	reminders: { label: 'Reminders', href: '/reminders' },
	admin: { label: 'Admin', href: '/admin' },
	about: { label: 'About', href: '/about' },
	edit: { label: 'Edit Event', href: '/edit' },
}

/**
 * Special route handlers for routes that require custom logic
 */
type SpecialRouteHandler = (pathParts: string[], items: BreadcrumbItem[]) => boolean

const SPECIAL_ROUTE_HANDLERS: SpecialRouteHandler[] = [
	// Handle instances with optional sub-path
	(pathParts, items) => {
		if (pathParts[0] === 'instances') {
			items.push({ label: 'Instances', href: '/instances' })
			if (pathParts[1]) {
				items.push({ label: pathParts[1] })
			}
			return true
		}
		return false
	},

	// Handle followers/pending
	(pathParts, items) => {
		if (pathParts[0] === 'followers' && pathParts[1] === 'pending') {
			items.push({ label: 'Pending Followers', href: '/followers/pending' })
			return true
		}
		return false
	},

	// Handle profile routes (@username)
	(pathParts, items) => {
		if (pathParts[0]?.startsWith('@')) {
			const username = pathParts[0].slice(1)
			items.push({ label: `@${username}`, href: `/${pathParts[0]}` })

			// If there's a second part, it's an event
			if (pathParts[1]) {
				items.push({ label: 'Event' })
			}
			return true
		}
		return false
	},
]

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

	// Try special route handlers first
	for (const handler of SPECIAL_ROUTE_HANDLERS) {
		if (handler(pathParts, items)) {
			return items
		}
	}

	// Check route configuration map for simple routes
	const firstPart = pathParts[0]
	if (firstPart && firstPart in ROUTE_CONFIG) {
		const config = ROUTE_CONFIG[firstPart]
		items.push({ label: config.label, href: config.href })
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
