import { divIcon } from 'leaflet'
import { renderToStaticMarkup } from 'react-dom/server'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { Link } from 'react-router-dom'

import { Badge, LocationIcon } from '@/components/ui'
import { useTheme } from '@/design-system'
import { Event } from '@/types'

import { formatDate, formatTime } from '../lib/formatUtils'

// Custom marker icon using our UI icon component (no external CDN)
const markerIcon = divIcon({
	className: 'constellate-marker-icon',
	html: renderToStaticMarkup(
		<span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
			<LocationIcon className="w-6 h-6 text-primary-600 drop-shadow" />
		</span>
	),
	iconSize: [24, 24],
	iconAnchor: [12, 24],
	popupAnchor: [0, -24],
})

// Generate a deterministic offset from a seed string
// Used to create slight variations in marker positions for events at the same location
function getOffset(seed: string): number {
	let hash = 0
	for (let i = 0; i < seed.length; i++) {
		hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
	}
	const x = (hash % 1000) / 1000
	return (x - 0.5) * 0.1
}

interface EventMapProps {
	events: Event[]
	height?: string
}

export function EventMap({ events, height = '500px' }: EventMapProps) {
	const { theme } = useTheme()

	// Filter events with location coordinates (assuming location field might contain them in future)
	// For now, we'll mock coordinates for demo purposes if location string is present
	// In a real implementation, you'd geocode the location string or have lat/long fields
	const eventsWithLocation = events.filter((e) => e.location)

	// Default center (can be user's location in future)
	const center: [number, number] = [51.505, -0.09] // London default

	// Dark mode map tiles
	const tileLayerUrl =
		theme === 'dark'
			? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
			: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

	const attribution =
		theme === 'dark'
			? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
			: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

	return (
		<div className="rounded-xl overflow-hidden border border-border-default shadow-sm z-0 relative">
			<MapContainer center={center} zoom={13} style={{ height, width: '100%' }}>
				<TileLayer attribution={attribution} url={tileLayerUrl} />
				{eventsWithLocation.map((event) => {
					// Demo coordinates based on deterministic hash of event id
					// In production, use event.latitude and event.longitude
					const lat = center[0] + getOffset(`${event.id}-lat`)
					const lng = center[1] + getOffset(`${event.id}-lng`)

					return (
						<Marker key={event.id} position={[lat, lng]} icon={markerIcon}>
							<Popup>
								<div className="p-1">
									<h3 className="font-semibold text-sm mb-1">
										{event.user?.username ? (
											<Link
												to={`/@${event.user.username}/${event.id}`}
												className="hover:underline text-primary-600">
												{event.title}
												</Link>
										) : (
											<span className="text-text-primary">{event.title}</span>
										)}
									</h3>
									<p className="text-xs text-text-secondary mb-2">
										{formatDate(event.startTime)} {formatTime(event.startTime)}
									</p>
									<div className="flex gap-1">
										{event.tags.slice(0, 2).map((tag) => (
											<Badge key={tag.id} variant="secondary" size="sm">
												#{tag.tag}
											</Badge>
										))}
									</div>
								</div>
							</Popup>
						</Marker>
					)
				})}
			</MapContainer>
		</div>
	)
}
