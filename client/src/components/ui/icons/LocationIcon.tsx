/**
 * Location/map pin icon component
 */
/* eslint-disable react-refresh/only-export-components */
export const LOCATION_ICON_PATH_DATA = [
	'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z',
	'M15 11a3 3 0 11-6 0 3 3 0 016 0z',
]

export function LocationIcon({ className = 'w-4 h-4' }: { className?: string }) {
	return (
		<svg
			className={className}
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
			aria-hidden="true">
			{LOCATION_ICON_PATH_DATA.map((d) => (
				<path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
			))}
		</svg>
	)
}
