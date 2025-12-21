import { divIcon, LatLngBounds } from 'leaflet'
import { useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { Link } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'

import { Badge, LOCATION_ICON_PATH_DATA } from '@/components/ui'
import { useTheme } from '@/design-system'
import { Event } from '@/types'

import { MAP_CONFIG } from '../config'
import { formatDate, formatTime } from '../lib/formatUtils'

// Custom marker icon using our UI icon component (no external CDN)
const createMarkerHtml = (colorClass: string) => `
<span style="display: inline-flex; align-items: center; justify-content: center;">
  <svg class="w-6 h-6 ${colorClass} drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    ${LOCATION_ICON_PATH_DATA.map(
		(d) =>
			`<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${d}"></path>`
	).join('')}
  </svg>
</span>
`

const lightMarkerIcon = divIcon({
	className: 'constellate-marker-icon',
	html: createMarkerHtml('text-primary-600'),
	iconSize: [24, 24],
	iconAnchor: [12, 24],
	popupAnchor: [0, -24],
})

const darkMarkerIcon = divIcon({
	className: 'constellate-marker-icon',
	html: createMarkerHtml('text-primary-400'),
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
	const markerIcon = theme === 'dark' ? darkMarkerIcon : lightMarkerIcon

	// Filter events with actual location coordinates
	const eventsWithLocation = useMemo(
		() =>
			events.filter(
				(e): e is Event & { locationLatitude: number; locationLongitude: number } =>
					e.locationLatitude != null && e.locationLongitude != null
			),
		[events]
	)

	// Calculate bounds of all events
	const bounds = useMemo(() => {
		if (eventsWithLocation.length === 0) {
			return null
		}

		const latLngBounds = new LatLngBounds([])
		eventsWithLocation.forEach((event) => {
			latLngBounds.extend([event.locationLatitude, event.locationLongitude])
		})

		// Add padding if it's a single point so we don't zoom in too much
		if (eventsWithLocation.length === 1) {
			latLngBounds.pad(0.1)
		}

		return latLngBounds
	}, [eventsWithLocation])

	// If no events with coordinates, don't render the map
	if (eventsWithLocation.length === 0 || !bounds) {
		return null
	}

	// Dark mode map tiles
	const { tileLayerUrl, attribution } = theme === 'dark' ? MAP_CONFIG.dark : MAP_CONFIG.light

	return (
		<div className="rounded-xl overflow-hidden border border-border-default shadow-sm relative">
			<MapContainer
				bounds={bounds}
				style={{ height, width: '100%' }}
				// Default center/zoom (will be overridden by bounds)
				center={[0, 0]}
				zoom={13}>
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
