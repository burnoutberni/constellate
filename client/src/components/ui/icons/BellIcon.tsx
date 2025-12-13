/**
 * Bell/notification icon component
 */
export function BellIcon({ hasUnread = false, className = 'w-6 h-6' }: { hasUnread?: boolean; className?: string }) {
	return (
		<svg
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true">
			<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
			<path d="M13.73 21a2 2 0 0 1-3.46 0" />
			{hasUnread ? <circle cx="18" cy="6" r="2" fill="currentColor" /> : null}
		</svg>
	)
}

