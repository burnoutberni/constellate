export type NavLink = {
	to: string
	label: string
}

/**
 * Get main navigation links (visible in navbar).
 */
export function getMainNavLinks(_hasUser: boolean): NavLink[] {
	return [
		{ to: '/discover', label: 'Discover' },
		{ to: '/calendar', label: 'Calendar' },
	]
}

/**
 * Get secondary navigation links (visible in "More" menu).
 */
export function getSecondaryNavLinks(hasUser: boolean): NavLink[] {
	return [
		...(hasUser
			? [
				{ to: '/templates', label: 'Templates' },
				{ to: '/instances', label: 'Instances' },
			]
			: []),
		{ to: '/about', label: 'About' },
	]
}
// Keep getNavLinks for backward compatibility if needed, combining both
export function getNavLinks(hasUser: boolean): NavLink[] {
	return [...getMainNavLinks(hasUser), ...getSecondaryNavLinks(hasUser)]
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
