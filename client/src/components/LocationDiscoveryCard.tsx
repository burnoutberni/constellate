import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useNearbyEvents } from '../hooks/queries'
import { useLocationSuggestions, LocationSuggestion, MIN_QUERY_LENGTH } from '../hooks/useLocationSuggestions'
import type { Event } from '../types'

const RADIUS_OPTIONS = [10, 25, 50, 100]

export function LocationDiscoveryCard() {
    const [locationQuery, setLocationQuery] = useState('')
    const [selectedLocation, setSelectedLocation] = useState<{ label: string; latitude: number; longitude: number } | null>(null)
    const [radiusKm, setRadiusKm] = useState(25)
    const [geoLoading, setGeoLoading] = useState(false)
    const [geoError, setGeoError] = useState<string | null>(null)

    const {
        suggestions,
        loading: suggestionLoading,
        error: suggestionError,
    } = useLocationSuggestions(locationQuery, true)

    const { data, isLoading } = useNearbyEvents(
        selectedLocation ? { latitude: selectedLocation.latitude, longitude: selectedLocation.longitude } : undefined,
        radiusKm,
        Boolean(selectedLocation),
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
        setGeoLoading(true)
        setGeoError(null)
        // Geolocation is necessary here to enable users to discover events near their current
        // location, which is a core feature of the location-based event discovery system.
        // eslint-disable-next-line sonarjs/no-intrusive-permissions
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
                console.error('Geolocation error:', err)
                setGeoError('Unable to access your current location.')
                setGeoLoading(false)
            },
            { enableHighAccuracy: true, timeout: 10000 },
        )
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
                    <p className="text-xs text-gray-500">Search by place or use your device location.</p>
                </div>
                <select
                    className="input w-28 text-sm"
                    value={radiusKm}
                    onChange={(event) => setRadiusKm(Number(event.target.value))}
                >
                    {RADIUS_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                            {option} km
                        </option>
                    ))}
                </select>
            </div>

            <div className="space-y-2">
                <input
                    type="text"
                    className="input"
                    placeholder="Search a city, venue, or address"
                    value={locationQuery}
                    onChange={(event) => setLocationQuery(event.target.value)}
                />
                {suggestionError && <p className="text-xs text-red-500">{suggestionError}</p>}
                {locationQuery.trim().length >= MIN_QUERY_LENGTH && (
                    <div className="space-y-2">
                        {suggestionLoading && <p className="text-xs text-gray-500">Searching places…</p>}
                        {!suggestionLoading && suggestions.length === 0 && (
                            <p className="text-xs text-gray-400">No matches yet. Keep typing for better results.</p>
                        )}
                        {suggestions.map((suggestion) => (
                            <button
                                key={suggestion.id}
                                type="button"
                                onClick={() => handleSuggestionSelect(suggestion)}
                                className="w-full text-left border border-gray-200 rounded-lg p-3 hover:border-blue-500 transition-colors"
                            >
                                <div className="font-medium text-gray-900">{suggestion.label}</div>
                                {suggestion.hint && (
                                    <div className="text-xs text-gray-500">{suggestion.hint}</div>
                                )}
                                <div className="text-xs text-gray-400 mt-1">
                                    {suggestion.latitude.toFixed(2)}, {suggestion.longitude.toFixed(2)}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex flex-wrap gap-3 text-sm">
                <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleUseMyLocation}
                    disabled={geoLoading}
                >
                    {geoLoading ? 'Locating…' : 'Use my location'}
                </button>
                <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={clearSelection}
                    disabled={!selectedLocation}
                >
                    Clear selection
                </button>
            </div>
            {geoError && <p className="text-xs text-red-500">{geoError}</p>}

            {selectedLocation ? (
                <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                        <span>
                            Showing events within {radiusKm} km of
                            {' '}
                            <span className="font-semibold text-gray-800">{selectedLocation.label}</span>
                        </span>
                        <span>
                            {selectedLocation.latitude.toFixed(2)}, {selectedLocation.longitude.toFixed(2)}
                        </span>
                    </div>
                    {isLoading && <div className="text-sm text-gray-500">Loading nearby events…</div>}
                    {!isLoading && data?.events.length === 0 && (
                        <div className="text-sm text-gray-500">No upcoming events in this radius yet.</div>
                    )}
                    <div className="space-y-3">
                        {data?.events.map((event: Event & { distanceKm?: number }) => {
                            const linkTarget = event.user?.username ? `/@${event.user.username}/${event.id}` : `/events/${event.id}`
                            return (
                                <Link
                                    key={event.id}
                                    to={linkTarget}
                                    className="block border border-gray-200 rounded-lg p-3 hover:border-blue-500 transition-colors"
                                >
                                    <div className="font-medium text-gray-900 truncate">{event.title}</div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {new Date(event.startTime).toLocaleString()}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {event.distanceKm?.toFixed(1)} km away
                                        {event.location && ` • ${event.location}`}
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                </div>
            ) : (
                <p className="text-sm text-gray-500">
                    Select a location or use your device location to discover nearby events.
                </p>
            )}
        </div>
    )
}
