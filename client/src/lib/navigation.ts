export type NavLink = {
	to: string
	label: string
}

/**
 * Get navigation links based on user authentication status.
 * @param hasUser - Whether a user is authenticated
 * @returns Array of navigation links
 */
export function getNavLinks(hasUser: boolean): NavLink[] {
	return [
		{ to: '/feed', label: 'Feed' },
		{ to: '/calendar', label: 'Calendar' },
		{ to: '/search', label: 'Search' },
		...(hasUser
			? [
					{ to: '/templates', label: 'Templates' },
					{ to: '/instances', label: 'Instances' },
				]
			: []),
		{ to: '/about', label: 'About' },
	]
}

/**
 * Determines if breadcrumbs should be shown for a given path.
 * Breadcrumbs are hidden on top-level navigation pages (homepage and main nav links)
 * to avoid redundancy, since these pages are already accessible via the navbar.
 * They are shown on deeper pages (profiles, event details, nested routes) where
 * they provide valuable navigation context.
 *
 * @param pathname - The current route pathname
 * @param topLevelPaths - Array of paths that are considered top-level (homepage + main nav links)
 * @returns true if breadcrumbs should be shown, false otherwise
 */
export function shouldShowBreadcrumbs(pathname: string, topLevelPaths: string[]): boolean {
	return !topLevelPaths.includes(pathname)
}
