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

