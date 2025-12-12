import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useNearbyEvents } from '@/hooks/queries'
import {
	useLocationSuggestions,
	LocationSuggestion,
	MIN_QUERY_LENGTH,
} from '../hooks/useLocationSuggestions'
import { Button, Input } from './ui'
import { logger } from '@/lib/logger'

// Radius options for nearby event discovery (in kilometers)
// These values align with common search distances and are within the backend's max radius of 500 km
const RADIUS_OPTIONS = [10, 25, 50, 100]

// Geolocation timeout in milliseconds (10 seconds)
// This provides sufficient time for high-accuracy location while preventing indefinite waits
const GEO_TIMEOUT_MS = 10000

export function LocationDiscoveryCard() {
	const [locationQuery, setLocationQuery] = useState('')
	const [selectedLocation, setSelectedLocation] = useState<{
		label: string
		latitude: number
		longitude: number
	} | null>(null)
	const [radiusKm, setRadiusKm] = useState(25)
	const [geoLoading, setGeoLoading] = useState(false)
	const [geoError, setGeoError] = useState<string | null>(null)
	const [showPermissionPrompt, setShowPermissionPrompt] = useState(false)

	const {
		suggestions,
		loading: suggestionLoading,
		error: suggestionError,
	} = useLocationSuggestions(locationQuery, true)

	const { data, isLoading } = useNearbyEvents(
		selectedLocation
			? { latitude: selectedLocation.latitude, longitude: selectedLocation.longitude }
			: undefined,
		radiusKm,
		Boolean(selectedLocation)
	)

	const handleSuggestionSelect = (suggestion: LocationSuggestion) => {
		setSelectedLocation({
			label: suggestion.label,
			latitude: suggestion.latitude,
			longitude: suggestion.longitude,
		})
		setLocationQuery('')
		setGeoError(null)
	}

	const handleUseMyLocation = () => {
		if (!navigator.geolocation) {
			setGeoError('Geolocation is not supported in this browser.')
			return
		}

		// Show permission explanation before requesting location
		setShowPermissionPrompt(true)
	}

	const handlePermissionConfirm = () => {
		setShowPermissionPrompt(false)
		setGeoLoading(true)
		setGeoError(null)
		// Geolocation is necessary here to enable users to discover events near their current
		// location, which is a core feature of the location-based event discovery system.
		navigator.geolocation.getCurrentPosition(
			(position) => {
				setSelectedLocation({
					label: 'Current location',
					latitude: position.coords.latitude,
					longitude: position.coords.longitude,
				})
				setLocationQuery('')
				setGeoLoading(false)
			},
			(err) => {
				logger.error('Geolocation error:', err)
				setGeoError('Unable to access your current location.')
				setGeoLoading(false)
			},
			{ enableHighAccuracy: true, timeout: GEO_TIMEOUT_MS }
		)
	}

	const handlePermissionCancel = () => {
		setShowPermissionPrompt(false)
	}

	const clearSelection = () => {
		setSelectedLocation(null)
		setGeoError(null)
	}

	return (
		<div className="card p-4 space-y-4">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="font-bold text-lg">Find events nearby</h2>
					<p className="text-xs text-neutral-500">
						Search by place or use your device location.
					</p>
				</div>
				<select
					className="input w-28 text-sm"
					value={radiusKm}
					onChange={(event) => setRadiusKm(Number(event.target.value))}>
					{RADIUS_OPTIONS.map((option) => (
						<option key={option} value={option}>
							{option} km
						</option>
					))}
				</select>
			</div>

			<div className="space-y-2">
				<Input
					type="text"
					placeholder="Search a city, venue, or address"
					value={locationQuery}
					onChange={(event) => setLocationQuery(event.target.value)}
					error={Boolean(suggestionError)}
					errorMessage={suggestionError || undefined}
				/>
				{locationQuery.trim().length >= MIN_QUERY_LENGTH && (
					<div className="space-y-2">
						{suggestionLoading && (
							<p className="text-xs text-neutral-500">Searching places…</p>
						)}
						{!suggestionLoading && suggestions.length === 0 && (
							<p className="text-xs text-neutral-400">
								No matches yet. Keep typing for better results.
							</p>
						)}
						{suggestions.map((suggestion) => (
							<Button
								key={suggestion.id}
								type="button"
								onClick={() => handleSuggestionSelect(suggestion)}
								variant="ghost"
								className="w-full justify-start border border-neutral-200 rounded-lg p-3 hover:border-info-500 transition-colors">
								<div className="font-medium text-neutral-900">
									{suggestion.label}
								</div>
								{suggestion.hint && (
									<div className="text-xs text-neutral-500">
										{suggestion.hint}
									</div>
								)}
								<div className="text-xs text-neutral-400 mt-1">
									{suggestion.latitude.toFixed(2)},{' '}
									{suggestion.longitude.toFixed(2)}
								</div>
							</Button>
						))}
					</div>
				)}
			</div>

			<div className="flex flex-wrap gap-3 text-sm">
				<Button
					type="button"
					variant="secondary"
					onClick={handleUseMyLocation}
					disabled={geoLoading}
					loading={geoLoading}>
					Use my location
				</Button>
				<Button
					type="button"
					variant="ghost"
					onClick={clearSelection}
					disabled={!selectedLocation}>
					Clear selection
				</Button>
			</div>
			{geoError && <p className="text-xs text-error-500">{geoError}</p>}

			{showPermissionPrompt && (
				<div className="border border-info-200 bg-info-50 rounded-lg p-4 space-y-3">
					<p className="text-sm text-info-900 font-medium">Location permission needed</p>
					<p className="text-xs text-info-700">
						We need your location to show you events happening nearby. Your location
						will only be used to find nearby events and will not be stored or shared.
					</p>
					<div className="flex gap-2">
						<Button
							type="button"
							onClick={handlePermissionConfirm}
							variant="primary"
							size="sm">
							Allow location
						</Button>
						<Button
							type="button"
							onClick={handlePermissionCancel}
							variant="ghost"
							size="sm">
							Cancel
						</Button>
					</div>
				</div>
			)}

			{selectedLocation ? (
				<div className="space-y-3">
					<div className="flex items-center justify-between text-sm text-neutral-600">
						<span>
							Showing events within {radiusKm} km of{' '}
							<span className="font-semibold text-neutral-800">
								{selectedLocation.label}
							</span>
						</span>
						<span>
							{selectedLocation.latitude.toFixed(2)},{' '}
							{selectedLocation.longitude.toFixed(2)}
						</span>
					</div>
					{isLoading && (
						<div className="text-sm text-neutral-500">Loading nearby events…</div>
					)}
					{!isLoading && data?.events.length === 0 && (
						<div className="text-sm text-neutral-500">
							No upcoming events in this radius yet.
						</div>
					)}
					<div className="space-y-3">
						{data?.events.map((event) => {
							const linkTarget = event.user?.username
								? `/@${event.user.username}/${event.id}`
								: `/events/${event.id}`
							return (
								<Link
									key={event.id}
									to={linkTarget}
									className="block border border-neutral-200 rounded-lg p-3 hover:border-info-500 transition-colors">
									<div className="font-medium text-neutral-900 truncate">
										{event.title}
									</div>
									<div className="text-xs text-neutral-500 mt-1">
										{new Date(event.startTime).toLocaleString()}
									</div>
									<div className="text-xs text-neutral-500">
										{event.distanceKm?.toFixed(1)} km away
										{event.location && ` • ${event.location}`}
									</div>
								</Link>
							)
						})}
					</div>
				</div>
			) : (
				<p className="text-sm text-neutral-500">
					Select a location or use your device location to discover nearby events.
				</p>
			)}
		</div>
	)
}
