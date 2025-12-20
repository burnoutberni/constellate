import { divIcon } from 'leaflet'
import { useMemo } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { Link } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'

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

interface EventMapProps {
	events: Event[]
	height?: string
}

export function EventMap({ events, height = '500px' }: EventMapProps) {
	const { theme } = useTheme()

	// Filter events with actual location coordinates
	const eventsWithLocation = useMemo(
		() =>
			events.filter(
				(e): e is Event & { locationLatitude: number; locationLongitude: number } =>
					e.locationLatitude != null && e.locationLongitude != null
			),
		[events]
	)

	// Calculate map center from average of all event coordinates
	const center: [number, number] = useMemo(() => {
		if (eventsWithLocation.length === 0) {
			return [0, 0]
		}
		const avgLat =
			eventsWithLocation.reduce((sum, e) => sum + e.locationLatitude, 0) /
			eventsWithLocation.length
		const avgLng =
			eventsWithLocation.reduce((sum, e) => sum + e.locationLongitude, 0) /
			eventsWithLocation.length
		return [avgLat, avgLng]
	}, [eventsWithLocation])

	// If no events with coordinates, don't render the map
	if (eventsWithLocation.length === 0) {
		return null
	}

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
		<div className="rounded-xl overflow-hidden border border-border-default shadow-sm relative">
			<MapContainer center={center} zoom={13} style={{ height, width: '100%' }}>
				<TileLayer attribution={attribution} url={tileLayerUrl} />
				<MarkerClusterGroup
					chunkedLoading
					maxClusterRadius={60}
					spiderfyOnMaxZoom={true}
					showCoverageOnHover={false}
					zoomToBoundsOnClick={true}>
					{eventsWithLocation.map((event) => {
						const lat = event.locationLatitude
						const lng = event.locationLongitude

						return (
							<Marker key={event.id} position={[lat, lng]} icon={markerIcon}>
								<Popup>
									<div className="p-1">
										<h3 className="font-semibold text-sm mb-1">
											{event.user?.username ? (
												<Link
													to={`/@${event.user.username}/${event.originalEventId || event.id}`}
													className="hover:underline text-primary-600">
													{event.title}
												</Link>
											) : (
												<span className="text-text-primary">
													{event.title}
												</span>
											)}
										</h3>
										<p className="text-xs text-text-secondary mb-2">
											{formatDate(event.startTime)}{' '}
											{formatTime(event.startTime)}
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
				</MarkerClusterGroup>
			</MapContainer>
		</div>
	)
}
