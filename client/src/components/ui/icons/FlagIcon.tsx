/**
 * Flag/report icon component
 */
export function FlagIcon({ className = 'w-4 h-4' }: { className?: string }) {
	return (
		<svg
			className={className}
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
			aria-hidden="true">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2z"
			/>
		</svg>
	)
}
