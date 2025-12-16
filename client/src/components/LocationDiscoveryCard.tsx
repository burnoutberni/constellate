import { useState } from 'react'
import { Link } from 'react-router-dom'

import { useNearbyEvents } from '@/hooks/queries'
import { logger } from '@/lib/logger'

import {
	useLocationSuggestions,
	LocationSuggestion,
	MIN_QUERY_LENGTH,
} from '../hooks/useLocationSuggestions'

import { Button, Input, Card, CardContent, CardTitle } from './ui'

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
		// navigator.geolocation is always defined in TypeScript's DOM types
		if (!('geolocation' in navigator) || !navigator.geolocation) {
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
		<Card className="space-y-4">
			<CardContent>
				<div className="flex items-center justify-between mb-4">
					<div>
						<CardTitle className="text-lg">Find events nearby</CardTitle>
						<p className="text-xs text-text-secondary">
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

				<div className="space-y-2 mb-4">
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
								<p className="text-xs text-text-secondary">Searching places…</p>
							)}
							{!suggestionLoading && suggestions.length === 0 && (
								<p className="text-xs text-text-tertiary">
									No matches yet. Keep typing for better results.
								</p>
							)}
							{suggestions.map((suggestion) => (
								<Button
									key={suggestion.id}
									type="button"
									onClick={() => handleSuggestionSelect(suggestion)}
									variant="ghost"
									className="w-full justify-start border border-border-default rounded-lg p-3 hover:border-info-500 transition-colors">
									<div className="font-medium text-text-primary">
										{suggestion.label}
									</div>
									{suggestion.hint && (
										<div className="text-xs text-text-secondary">
											{suggestion.hint}
										</div>
									)}
									<div className="text-xs text-text-tertiary mt-1">
										{suggestion.latitude.toFixed(2)},{' '}
										{suggestion.longitude.toFixed(2)}
									</div>
								</Button>
							))}
						</div>
					)}
				</div>

				<div className="flex flex-wrap gap-3 text-sm mb-4">
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
				{geoError && <p className="text-xs text-error-500 mb-4">{geoError}</p>}

				{showPermissionPrompt && (
					<div className="border border-info-200 bg-info-50 dark:bg-info-900/20 rounded-lg p-4 space-y-3 mb-4">
						<p className="text-sm text-info-900 dark:text-info-100 font-medium">
							Location permission needed
						</p>
						<p className="text-xs text-info-700 dark:text-info-300">
							We need your location to show you events happening nearby. Your location
							will only be used to find nearby events and will not be stored or
							shared.
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
						<div className="flex items-center justify-between text-sm text-text-secondary">
							<span>
								Showing events within {radiusKm} km of{' '}
								<span className="font-semibold text-text-primary">
									{selectedLocation.label}
								</span>
							</span>
							<span>
								{selectedLocation.latitude.toFixed(2)},{' '}
								{selectedLocation.longitude.toFixed(2)}
							</span>
						</div>
						{isLoading && (
							<div className="text-sm text-text-secondary">
								Loading nearby events…
							</div>
						)}
						{!isLoading && data?.events.length === 0 && (
							<div className="text-sm text-text-secondary">
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
										className="block border border-border-default rounded-lg p-3 hover:border-info-500 transition-colors">
										<div className="font-medium text-text-primary truncate">
											{event.title}
										</div>
										<div className="text-xs text-text-secondary mt-1">
											{new Date(event.startTime).toLocaleString()}
										</div>
										<div className="text-xs text-text-secondary">
											{event.distanceKm?.toFixed(1)} km away
											{event.location && ` • ${event.location}`}
										</div>
									</Link>
								)
							})}
						</div>
					</div>
				) : (
					<p className="text-sm text-text-secondary">
						Select a location or use your device location to discover nearby events.
					</p>
				)}
			</CardContent>
		</Card>
	)
}
