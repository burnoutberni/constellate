import { useState, useEffect, useCallback, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useEventDetail, useUpdateEvent } from '@/hooks/queries'
import { useLocationSuggestions, LocationSuggestion, MIN_QUERY_LENGTH } from '../hooks/useLocationSuggestions'
import { validateRecurrence, parseCoordinates, buildEventPayload } from '../lib/eventFormUtils'
import { VISIBILITY_OPTIONS } from '../lib/visibility'
import { Button, Card, CardContent } from '@/components/ui'
import { Container } from '@/components/layout'
import { Navbar } from '../components/Navbar'
import { useUIStore } from '@/stores'
import type { EventVisibility } from '@/types'

const MAX_TAG_LENGTH = 50
const COORDINATE_DECIMAL_PLACES = 6
const GEO_TIMEOUT_MS = 10000

const normalizeTagInput = (input: string): string => input.trim().replace(/^#+/, '').trim().toLowerCase()

export function EditEventPage() {
    const { user } = useAuth()
    const location = useLocation()
    const navigate = useNavigate()
    const addErrorToast = useUIStore((state) => state.addErrorToast)

    const [username, setUsername] = useState('')
    const [eventId, setEventId] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [formData, setFormData] = useState<{
        title: string
        summary: string
        location: string
        locationLatitude: string
        locationLongitude: string
        url: string
        startTime: string
        endTime: string
        visibility: EventVisibility
        recurrencePattern: string
        recurrenceEndDate: string
        tags: string[]
    }>({
        title: '',
        summary: '',
        location: '',
        locationLatitude: '',
        locationLongitude: '',
        url: '',
        startTime: '',
        endTime: '',
        visibility: 'PUBLIC',
        recurrencePattern: '',
        recurrenceEndDate: '',
        tags: [],
    })
    const [tagInput, setTagInput] = useState('')
    const [tagError, setTagError] = useState<string | null>(null)
    const [locationSearch, setLocationSearch] = useState('')
    const [geoLoading, setGeoLoading] = useState(false)

    const {
        suggestions: locationSuggestions,
    } = useLocationSuggestions(locationSearch, true)

    // Extract username and eventId from pathname
    useEffect(() => {
        // Path format: /edit/@username/eventId or /edit/@username@domain/eventId
        const pathParts = location.pathname.split('/').filter(Boolean)
        if (pathParts.length >= 3 && pathParts[0] === 'edit' && pathParts[1].startsWith('@')) {
            const extractedUsername = pathParts[1].slice(1) // Remove @
            const extractedEventId = pathParts[2]
            setUsername(extractedUsername)
            setEventId(extractedEventId)
        }
    }, [location.pathname])

    // Fetch event data
    const { data: event, isLoading } = useEventDetail(username, eventId)
    const updateMutation = useUpdateEvent(eventId, username)

    // Populate form when event loads
    useEffect(() => {
        if (!event) {
return
}

        // Check if user is owner
        if (user?.id !== event.user?.id) {
            addErrorToast({ id: crypto.randomUUID(), message: 'You do not have permission to edit this event.' })
            navigate(`/@${username}/${eventId}`, { replace: true })
            return
        }

        setFormData({
            title: event.title,
            summary: event.summary || '',
            location: event.location || '',
            locationLatitude: event.locationLatitude?.toString() || '',
            locationLongitude: event.locationLongitude?.toString() || '',
            url: event.url || '',
            startTime: event.startTime ? event.startTime.slice(0, 16) : '', // Format for datetime-local input
            endTime: event.endTime ? event.endTime.slice(0, 16) : '',
            visibility: event.visibility as EventVisibility || 'PUBLIC',
            recurrencePattern: event.recurrencePattern || '',
            recurrenceEndDate: event.recurrenceEndDate ? event.recurrenceEndDate.slice(0, 10) : '',
            tags: event.tags?.map((t) => t.tag) || [],
        })
    }, [event, user, username, eventId, navigate, addErrorToast])

    const addTag = useCallback(() => {
        setTagError(null)
        if (!tagInput.trim()) {
            return
        }

        const tag = normalizeTagInput(tagInput)

        if (!tag) {
            setTagError('Tag cannot be empty after normalization')
            return
        }

        if (tag.length > MAX_TAG_LENGTH) {
            setTagError(`Tag must be ${MAX_TAG_LENGTH} characters or less after normalization (currently ${tag.length} characters)`)
            return
        }

        setFormData((prev) => {
            if (!prev.tags.includes(tag)) {
                setTagInput('')
                return { ...prev, tags: [...prev.tags, tag] }
            }
                setTagError('This tag has already been added')
                return prev
        })
    }, [tagInput])

    const removeTag = (tag: string) => {
        setFormData((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }))
    }

    const handleSuggestionSelect = (suggestion: LocationSuggestion) => {
        setFormData((prev) => ({
            ...prev,
            location: suggestion.label,
            locationLatitude: suggestion.latitude.toFixed(COORDINATE_DECIMAL_PLACES),
            locationLongitude: suggestion.longitude.toFixed(COORDINATE_DECIMAL_PLACES),
        }))
        setLocationSearch('')
    }

    const clearCoordinates = () => {
        setFormData((prev) => ({
            ...prev,
            locationLatitude: '',
            locationLongitude: '',
        }))
    }

    const handleUseCurrentLocation = () => {
        if (!navigator.geolocation) {
            addErrorToast({ id: crypto.randomUUID(), message: 'Geolocation is not supported in this browser.' })
            return
        }
        setGeoLoading(true)
        // Geolocation is necessary here to allow users to quickly set event coordinates
        // for location-based features like map display and nearby event discovery.
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setFormData((prev) => ({
                    ...prev,
                    locationLatitude: position.coords.latitude.toFixed(COORDINATE_DECIMAL_PLACES),
                    locationLongitude: position.coords.longitude.toFixed(COORDINATE_DECIMAL_PLACES),
                }))
                setGeoLoading(false)
            },
            (err) => {
                console.error('Geolocation error:', err)
                addErrorToast({ id: crypto.randomUUID(), message: 'Unable to access your current location.' })
                setGeoLoading(false)
            },
            { enableHighAccuracy: true, timeout: GEO_TIMEOUT_MS },
        )
    }

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setError(null)

        if (!formData.title.trim()) {
            setError('Please enter an event title.')
            return
        }

        if (!formData.startTime) {
            setError('Please choose a start time.')
            return
        }

        const recurrenceError = validateRecurrence(formData)
        if (recurrenceError) {
            setError(recurrenceError)
            return
        }

        const coordinatesResult = parseCoordinates(formData)
        if ('error' in coordinatesResult) {
            setError(coordinatesResult.error)
            return
        }

        const locationLatitude = 'latitude' in coordinatesResult ? coordinatesResult.latitude : undefined
        const locationLongitude = 'longitude' in coordinatesResult ? coordinatesResult.longitude : undefined

        try {
            const payload = buildEventPayload(
                formData,
                locationLatitude,
                locationLongitude,
                true, // isUpdate
            )

            if (formData.tags.length > 0) {
                payload.tags = formData.tags
            }

            await updateMutation.mutateAsync(payload)

            // Navigate back to event detail page
            navigate(`/@${username}/${eventId}`)
        } catch (err) {
            console.error('Update failed:', err)
            const errorMessage = err instanceof Error ? err.message : 'Failed to update event. Please try again.'
            setError(errorMessage)
            addErrorToast({ id: crypto.randomUUID(), message: errorMessage })
        }
    }

    const handleCancel = () => {
        navigate(`/@${username}/${eventId}`)
    }

    if (isLoading) {
        return (
            <>
                <Navbar />
                <Container size="md" className="py-8">
                    <div className="text-center text-text-secondary">Loading event...</div>
                </Container>
            </>
        )
    }

    if (!event || !user) {
        return (
            <>
                <Navbar />
                <Container size="md" className="py-8">
                    <div className="text-center text-text-secondary">Event not found or you don&apos;t have permission to edit it.</div>
                </Container>
            </>
        )
    }

    return (
        <>
            <Navbar />
            <Container size="md" className="py-8">
                <Card variant="elevated" padding="lg">
                    <CardContent>
                        <h1 className="text-2xl font-bold text-text-primary mb-6">Edit Event</h1>

                        {error && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Title */}
                            <div>
                                <label className="block text-sm font-semibold text-text-primary mb-2">
                                    Event Title *
                                </label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-3 py-2 border border-border-default rounded-lg bg-background-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-600"
                                    placeholder="Enter event title"
                                    required
                                />
                            </div>

                            {/* Summary */}
                            <div>
                                <label className="block text-sm font-semibold text-text-primary mb-2">
                                    Description
                                </label>
                                <textarea
                                    value={formData.summary}
                                    onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                                    className="w-full px-3 py-2 border border-border-default rounded-lg bg-background-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-600"
                                    placeholder="Describe your event"
                                    rows={4}
                                />
                            </div>

                            {/* Start Time */}
                            <div>
                                <label className="block text-sm font-semibold text-text-primary mb-2">
                                    Start Time *
                                </label>
                                <input
                                    type="datetime-local"
                                    value={formData.startTime}
                                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                    className="w-full px-3 py-2 border border-border-default rounded-lg bg-background-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-600"
                                    required
                                />
                            </div>

                            {/* End Time */}
                            <div>
                                <label className="block text-sm font-semibold text-text-primary mb-2">
                                    End Time
                                </label>
                                <input
                                    type="datetime-local"
                                    value={formData.endTime}
                                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                    className="w-full px-3 py-2 border border-border-default rounded-lg bg-background-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-600"
                                />
                            </div>

                            {/* Location */}
                            <div>
                                <label className="block text-sm font-semibold text-text-primary mb-2">
                                    Location
                                </label>
                                <input
                                    type="text"
                                    value={formData.location}
                                    onChange={(e) => {
                                        setFormData({ ...formData, location: e.target.value })
                                        setLocationSearch(e.target.value)
                                    }}
                                    className="w-full px-3 py-2 border border-border-default rounded-lg bg-background-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-600"
                                    placeholder="Enter location"
                                />
                                {locationSearch.length >= MIN_QUERY_LENGTH && locationSuggestions.length > 0 && (
                                    <div className="mt-2 border border-border-default rounded-lg bg-background-primary shadow-lg">
                                        {locationSuggestions.map((suggestion) => (
                                            <button
                                                key={suggestion.id}
                                                type="button"
                                                onClick={() => handleSuggestionSelect(suggestion)}
                                                className="w-full px-3 py-2 text-left hover:bg-background-tertiary text-text-primary"
                                            >
                                                {suggestion.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Coordinates */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-text-primary mb-2">
                                        Latitude
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.locationLatitude}
                                        onChange={(e) => setFormData({ ...formData, locationLatitude: e.target.value })}
                                        className="w-full px-3 py-2 border border-border-default rounded-lg bg-background-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-600"
                                        placeholder="e.g., 40.7128"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-text-primary mb-2">
                                        Longitude
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.locationLongitude}
                                        onChange={(e) => setFormData({ ...formData, locationLongitude: e.target.value })}
                                        className="w-full px-3 py-2 border border-border-default rounded-lg bg-background-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-600"
                                        placeholder="e.g., -74.0060"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={handleUseCurrentLocation}
                                    disabled={geoLoading}
                                    loading={geoLoading}
                                >
                                    Use Current Location
                                </Button>
                                {(formData.locationLatitude || formData.locationLongitude) && (
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={clearCoordinates}
                                    >
                                        Clear Coordinates
                                    </Button>
                                )}
                            </div>

                            {/* URL */}
                            <div>
                                <label className="block text-sm font-semibold text-text-primary mb-2">
                                    Event URL
                                </label>
                                <input
                                    type="url"
                                    value={formData.url}
                                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                    className="w-full px-3 py-2 border border-border-default rounded-lg bg-background-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-600"
                                    placeholder="https://example.com"
                                />
                            </div>

                            {/* Visibility */}
                            <div>
                                <label className="block text-sm font-semibold text-text-primary mb-2">
                                    Visibility
                                </label>
                                <select
                                    value={formData.visibility}
                                    onChange={(e) => setFormData({ ...formData, visibility: e.target.value as EventVisibility })}
                                    className="w-full px-3 py-2 border border-border-default rounded-lg bg-background-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-600"
                                >
                                    {VISIBILITY_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label} - {option.description}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Recurrence Pattern */}
                            <div>
                                <label className="block text-sm font-semibold text-text-primary mb-2">
                                    Recurrence
                                </label>
                                <select
                                    value={formData.recurrencePattern}
                                    onChange={(e) => setFormData({ ...formData, recurrencePattern: e.target.value })}
                                    className="w-full px-3 py-2 border border-border-default rounded-lg bg-background-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-600"
                                >
                                    <option value="">Does not repeat</option>
                                    <option value="DAILY">Daily</option>
                                    <option value="WEEKLY">Weekly</option>
                                    <option value="MONTHLY">Monthly</option>
                                </select>
                            </div>

                            {/* Recurrence End Date */}
                            {formData.recurrencePattern && (
                                <div>
                                    <label className="block text-sm font-semibold text-text-primary mb-2">
                                        Repeat Until *
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.recurrenceEndDate}
                                        onChange={(e) => setFormData({ ...formData, recurrenceEndDate: e.target.value })}
                                        className="w-full px-3 py-2 border border-border-default rounded-lg bg-background-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-600"
                                        required={Boolean(formData.recurrencePattern)}
                                    />
                                </div>
                            )}

                            {/* Tags */}
                            <div>
                                <label className="block text-sm font-semibold text-text-primary mb-2">
                                    Tags
                                </label>
                                <div className="flex gap-2 mb-2">
                                    <input
                                        type="text"
                                        value={tagInput}
                                        onChange={(e) => setTagInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault()
                                                addTag()
                                            }
                                        }}
                                        className="flex-1 px-3 py-2 border border-border-default rounded-lg bg-background-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-600"
                                        placeholder="Add a tag"
                                    />
                                    <Button type="button" variant="secondary" size="sm" onClick={addTag}>
                                        Add
                                    </Button>
                                </div>
                                {tagError && (
                                    <div className="text-sm text-red-600 mb-2">{tagError}</div>
                                )}
                                {formData.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {formData.tags.map((tag) => (
                                            <span
                                                key={tag}
                                                className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 text-primary-700 rounded text-sm"
                                            >
                                                #{tag}
                                                <button
                                                    type="button"
                                                    onClick={() => removeTag(tag)}
                                                    className="hover:text-primary-900"
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-4">
                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="lg"
                                    disabled={updateMutation.isPending}
                                    loading={updateMutation.isPending}
                                    className="flex-1"
                                >
                                    {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                                </Button>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="lg"
                                    onClick={handleCancel}
                                    disabled={updateMutation.isPending}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </Container>
        </>
    )
}
