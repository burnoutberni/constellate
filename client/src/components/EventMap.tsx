import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { Icon } from 'leaflet'
import { Link } from 'react-router-dom'
import { useTheme } from '@/design-system'
import { Badge } from './ui'
import { Event } from '@/types'

// Fix for default marker icon
const defaultIcon = new Icon({
	iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
	iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
	shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
	iconSize: [25, 41],
	iconAnchor: [12, 41],
	popupAnchor: [1, -34],
	shadowSize: [41, 41],
})

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
					// Mock random coordinates near center for demo
					// In production, use event.latitude and event.longitude
					const lat = center[0] + (Math.random() - 0.5) * 0.1
					const lng = center[1] + (Math.random() - 0.5) * 0.1

					return (
						<Marker key={event.id} position={[lat, lng]} icon={defaultIcon}>
							<Popup>
								<div className="p-1">
									<h3 className="font-semibold text-sm mb-1">
										<Link
											to={`/@${event.user?.username || 'unknown'}/${event.id}`}
											className="hover:underline text-primary-600">
											{event.title}
										</Link>
									</h3>
									<p className="text-xs text-text-secondary mb-2">
										{new Date(event.startTime).toLocaleString()}
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
