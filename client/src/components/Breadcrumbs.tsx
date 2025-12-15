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
 * Formats a path part into a human-readable label.
 * Capitalizes words and replaces hyphens with spaces.
 */
function formatPathPartToLabel(part: string): string {
	return part
		.split('-')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ')
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
 * Processes sub-paths from a pathParts array starting at the given index.
 * Returns an array of BreadcrumbItems for the remaining path parts.
 */
function processSubPaths(pathParts: string[], startIndex: number): BreadcrumbItem[] {
	const items: BreadcrumbItem[] = []

	pathParts.slice(startIndex).forEach((part, index) => {
		const href = `/${pathParts.slice(0, startIndex + index + 1).join('/')}`

		// Check route configuration first
		if (part && part in ROUTE_CONFIG) {
			const config = ROUTE_CONFIG[part]
			items.push({ label: config.label, href })
		} else {
			items.push({ label: formatPathPartToLabel(part), href })
		}
	})

	return items
}

/**
 * Special route handlers for routes that require custom logic.
 * Returns an array of BreadcrumbItems if the handler processes the path, or null otherwise.
 */
type SpecialRouteHandler = (pathParts: string[]) => BreadcrumbItem[] | null

const SPECIAL_ROUTE_HANDLERS: SpecialRouteHandler[] = [
	// Handle instances with optional sub-path
	(pathParts) => {
		if (pathParts[0] === 'instances') {
			const items: BreadcrumbItem[] = [{ label: 'Instances', href: '/instances' }]
			items.push(...processSubPaths(pathParts, 1))
			return items
		}
		return null
	},

	// Handle followers/pending
	(pathParts) => {
		if (pathParts[0] === 'followers' && pathParts[1] === 'pending') {
			return [{ label: 'Pending Followers', href: '/followers/pending' }]
		}
		return null
	},

	// Handle profile routes (@username)
	(pathParts) => {
		if (pathParts[0]?.startsWith('@')) {
			const username = pathParts[0].slice(1)
			const items: BreadcrumbItem[] = [{ label: `@${username}`, href: `/${pathParts[0]}` }]
			items.push(...processSubPaths(pathParts, 1))
			return items
		}
		return null
	},
]

/**
 * Generates breadcrumb items from a route path.
 * Note: This function can generate breadcrumbs for any path, but visibility
 * is controlled by the parent component (typically Navbar) using shouldShowBreadcrumbs()
 * from @/lib/navigation.
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
		const handlerItems = handler(pathParts)
		if (handlerItems !== null) {
			items.push(...handlerItems)
			return items
		}
	}

	// Check route configuration map for simple routes
	items.push(...processSubPaths(pathParts, 0))

	return items
}
