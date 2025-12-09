import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import type { EventVisibility } from '../types'
import { VISIBILITY_OPTIONS } from '../lib/visibility'
import { useLocationSuggestions, LocationSuggestion, MIN_QUERY_LENGTH } from '../hooks/useLocationSuggestions'
import { validateRecurrence, parseCoordinates, buildEventPayload as buildEventPayloadUtil } from '../lib/eventFormUtils'

interface CreateEventModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

const MAX_TAG_LENGTH = 50

// Geolocation timeout in milliseconds (10 seconds)
// This provides sufficient time for high-accuracy location while preventing indefinite waits
const GEO_TIMEOUT_MS = 10000

// Coordinate precision: 6 decimal places provides approximately 0.1 meter precision
// This is sufficient for most event location needs while keeping coordinate strings manageable
const COORDINATE_DECIMAL_PLACES = 6

// Helper function to normalize tag input
const normalizeTagInput = (input: string): string => {
    return input.trim().replace(/^#+/, '').trim().toLowerCase()
}

interface EventTemplate {
    id: string
    name: string
    description?: string | null
    data: {
        title?: string
        summary?: string
        location?: string
        locationLatitude?: number
        locationLongitude?: number
        url?: string
        startTime?: string
        endTime?: string
    }
}

export function CreateEventModal({ isOpen, onClose, onSuccess }: CreateEventModalProps) {
    const { user } = useAuth()
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
        tags: [] as string[],
    })
    const [tagInput, setTagInput] = useState('')
    const [tagError, setTagError] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [templates, setTemplates] = useState<EventTemplate[]>([])
    const [templatesLoading, setTemplatesLoading] = useState(false)
    const [templateError, setTemplateError] = useState<string | null>(null)
    const [selectedTemplateId, setSelectedTemplateId] = useState('')
    const [saveAsTemplate, setSaveAsTemplate] = useState(false)
    const [templateName, setTemplateName] = useState('')
    const [templateDescription, setTemplateDescription] = useState('')
    const [locationSearch, setLocationSearch] = useState('')
    const [geoLoading, setGeoLoading] = useState(false)

    const {
        suggestions: locationSuggestions,
        loading: locationSuggestionsLoading,
        error: locationSuggestionsError,
    } = useLocationSuggestions(locationSearch, isOpen)

    const addTag = useCallback(() => {
        setTagError(null)
        if (!tagInput.trim()) {
            return
        }
        
        // Normalize first, then validate the normalized result
        const tag = normalizeTagInput(tagInput)
        
        if (!tag) {
            setTagError('Tag cannot be empty after normalization')
            return
        }
        
        // Validate length after normalization (backend enforces .max(50))
        if (tag.length > MAX_TAG_LENGTH) {
            setTagError(`Tag must be ${MAX_TAG_LENGTH} characters or less after normalization (currently ${tag.length} characters)`)
            return
        }
        
        setFormData(prev => {
            if (!prev.tags.includes(tag)) {
                setTagInput('')
                return { ...prev, tags: [...prev.tags, tag] }
            } else {
                setTagError('This tag has already been added')
                return prev
            }
        })
    }, [tagInput])

    const loadTemplates = useCallback(async (): Promise<EventTemplate[]> => {
        if (!user) {
            return []
        }
        const response = await fetch('/api/event-templates', {
            credentials: 'include',
        })
        if (!response.ok) {
            throw new Error('Unable to load templates')
        }
        const body = await response.json() as { templates?: EventTemplate[] }
        return Array.isArray(body.templates) ? body.templates : []
    }, [user])

    useEffect(() => {
        if (!isOpen || !user) {
            return
        }
        let active = true
        setTemplatesLoading(true)
        setTemplateError(null)
        loadTemplates()
            .then((result) => {
                if (active) {
                    setTemplates(result)
                }
            })
            .catch(() => {
                if (active) {
                    setTemplateError('Unable to load your templates right now.')
                }
            })
            .finally(() => {
                if (active) {
                    setTemplatesLoading(false)
                }
            })
        return () => {
            active = false
        }
    }, [isOpen, user, loadTemplates])

    useEffect(() => {
        if (!isOpen) {
            // Reset form when modal closes
            setFormData({
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
            setLocationSearch('')
            setTagInput('')
            setTagError(null)
            setSelectedTemplateId('')
            setSaveAsTemplate(false)
            setTemplateName('')
            setTemplateDescription('')
            setError(null)
            setGeoLoading(false)
        }
    }, [isOpen])

    useEffect(() => {
        if (!saveAsTemplate) {
            setTemplateName('')
            setTemplateDescription('')
            return
        }

        if (formData.title) {
            setTemplateName((prev) => prev || formData.title)
        }
    }, [saveAsTemplate, formData.title])

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
            window.alert('Geolocation is not supported in this browser.')
            return
        }
        setGeoLoading(true)
        // Geolocation is necessary here to allow users to quickly set event coordinates
        // for location-based features like map display and nearby event discovery.
        // eslint-disable-next-line sonarjs/no-intrusive-permissions
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
                window.alert('Unable to access your current location.')
                setGeoLoading(false)
            },
            { enableHighAccuracy: true, timeout: GEO_TIMEOUT_MS },
        )
    }

    const applyTemplate = (templateId: string) => {
        setSelectedTemplateId(templateId)
        if (!templateId) {
            return
        }
        const template = templates.find((item) => item.id === templateId)
        if (!template) {
            return
        }
        setFormData({
            title: template.data.title || '',
            summary: template.data.summary || '',
            location: template.data.location || '',
            locationLatitude: template.data.locationLatitude !== undefined
                ? template.data.locationLatitude.toString()
                : '',
            locationLongitude: template.data.locationLongitude !== undefined
                ? template.data.locationLongitude.toString()
                : '',
            url: template.data.url || '',
            startTime: '',
            endTime: '',
            visibility: formData.visibility,
            recurrencePattern: '',
            recurrenceEndDate: '',
            tags: formData.tags,
        })
    }

    const refreshTemplates = async () => {
        if (!user) return
        setTemplatesLoading(true)
        setTemplateError(null)
        try {
            const latest = await loadTemplates()
            setTemplates(latest)
        } catch (err) {
            console.error('Failed to reload templates', err)
            setTemplateError('Unable to refresh templates. Please try again later.')
        } finally {
            setTemplatesLoading(false)
        }
    }

    const saveTemplateFromEvent = async (payload: {
        title: string
        summary?: string
        location?: string
        locationLatitude?: number
        locationLongitude?: number
        headerImage?: string
        url?: string
        startTime: string
        endTime?: string
        duration?: string
        eventStatus?: string
        eventAttendanceMode?: string
        maximumAttendeeCapacity?: number
    }) => {
        const templateLabel = templateName.trim() || payload.title
        if (!templateLabel) {
            return
        }
        const response = await fetch('/api/event-templates', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: templateLabel,
                description: templateDescription.trim() || undefined,
                data: payload,
            }),
        })
        if (!response.ok) {
            throw new Error('Failed to save template')
        }
        const created = await response.json() as EventTemplate
        setTemplates((current) => [created, ...current.filter((item) => item.id !== created.id)])
    }

    const locationQueryActive = locationSearch.trim().length >= MIN_QUERY_LENGTH

    const resetForm = () => {
        setFormData({
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
        setSelectedTemplateId('')
        setSaveAsTemplate(false)
        setTemplateName('')
        setTemplateDescription('')
        setTagInput('')
        setLocationSearch('')
    }

    const handleSuccessfulSubmission = async (locationLatitude?: number, locationLongitude?: number) => {
        if (saveAsTemplate) {
            try {
                // Note: Tags are intentionally excluded from templates as they are event-specific
                // and shouldn't be part of a reusable template. When loading from a template,
                // existing tags are preserved (see applyTemplate function).
                await saveTemplateFromEvent({
                    title: formData.title,
                    summary: formData.summary,
                    location: formData.location,
                    locationLatitude,
                    locationLongitude,
                    url: formData.url,
                    startTime: new Date(formData.startTime).toISOString(),
                    endTime: formData.endTime ? new Date(formData.endTime).toISOString() : undefined,
                })
            } catch (err) {
                console.error('Failed to save template', err)
                window.alert('Your event was created, but saving the template failed. You can try again later from the event details page.')
            }
        }
        resetForm()
        onSuccess()
        onClose()
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        
        if (!user) {
            setError('You must be signed in to create an event.')
            return
        }

        const validationError = validateRecurrence({
            recurrencePattern: formData.recurrencePattern,
            recurrenceEndDate: formData.recurrenceEndDate,
            startTime: formData.startTime,
        })
        if (validationError) {
            setError(validationError)
            setSubmitting(false)
            return
        }

        try {
            setSubmitting(true)

            const recurrenceError = validateRecurrence(formData)
            if (recurrenceError) {
                setError(recurrenceError)
                setSubmitting(false)
                return
            }

            const coordinateResult = parseCoordinates(formData)
            if (coordinateResult.error) {
                setError(coordinateResult.error)
                setSubmitting(false)
                return
            }

            const payload = buildEventPayloadUtil(formData, coordinateResult.latitude, coordinateResult.longitude)
            const response = await fetch('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    ...payload,
                    tags: formData.tags.length > 0 ? formData.tags : undefined,
                }),
            })

            if (response.ok) {
                await handleSuccessfulSubmission(coordinateResult.latitude, coordinateResult.longitude)
            } else if (response.status === 401) {
                setError('Authentication required. Please sign in.')
            } else {
                setError('Failed to create event. Please try again.')
            }
        } catch (err) {
            setError('Error creating event. Please try again.')
            console.error('Error creating event:', err)
        } finally {
            setSubmitting(false)
        }
    }

    if (!isOpen) {
        return null
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold">Create Event</h2>
                        <button
                            onClick={onClose}
                            className="text-gray-500 hover:text-gray-700 text-2xl"
                        >
                            ×
                        </button>
                    </div>
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
                            {error}
                        </div>
                    )}
                    {user && (
                        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3 mb-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold">Start from template</p>
                                    <p className="text-xs text-gray-500">Prefill fields with a saved configuration.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={refreshTemplates}
                                    className="text-sm text-primary-600 hover:underline disabled:opacity-50"
                                    disabled={templatesLoading}
                                >
                                    {templatesLoading ? 'Refreshing...' : 'Refresh'}
                                </button>
                            </div>
                            <select
                                value={selectedTemplateId}
                                onChange={(event) => applyTemplate(event.target.value)}
                                className="input"
                                disabled={templatesLoading || templates.length === 0}
                            >
                                <option value="">{templates.length ? 'Select a template' : 'No templates yet'}</option>
                                {templates.map((template) => (
                                    <option key={template.id} value={template.id}>
                                        {template.name}
                                    </option>
                                ))}
                            </select>
                            {templateError && (
                                <p className="text-xs text-red-500">{templateError}</p>
                            )}
                        </div>
                    )}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Event Title *
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="input"
                                placeholder="Team Meeting"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Description
                            </label>
                            <textarea
                                value={formData.summary}
                                onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                                className="textarea"
                                rows={4}
                                placeholder="What's this event about?"
                            />
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Start Date & Time *
                                </label>
                                <input
                                    type="datetime-local"
                                    required
                                    value={formData.startTime}
                                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                    className="input"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    End Date & Time
                                </label>
                                <input
                                    type="datetime-local"
                                    value={formData.endTime}
                                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                    className="input"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Location label
                                </label>
                                <input
                                    type="text"
                                    value={formData.location}
                                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                    className="input"
                                    placeholder="Conference Room A"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    This text is shown on cards and detail pages (e.g., venue or meeting link).
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Coordinates (for map & nearby search)
                                </label>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <span className="text-xs uppercase text-gray-500">Latitude</span>
                                        <input
                                            type="number"
                                            step="0.000001"
                                            value={formData.locationLatitude}
                                            onChange={(e) => setFormData({ ...formData, locationLatitude: e.target.value })}
                                            className="input mt-1"
                                            placeholder="40.7128"
                                        />
                                    </div>
                                    <div>
                                        <span className="text-xs uppercase text-gray-500">Longitude</span>
                                        <input
                                            type="number"
                                            step="0.000001"
                                            value={formData.locationLongitude}
                                            onChange={(e) => setFormData({ ...formData, locationLongitude: e.target.value })}
                                            className="input mt-1"
                                            placeholder="-74.0060"
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-3 mt-2">
                                    <button
                                        type="button"
                                        className="btn btn-secondary text-sm"
                                        onClick={handleUseCurrentLocation}
                                        disabled={geoLoading}
                                    >
                                        {geoLoading ? 'Locating…' : 'Use my location'}
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-ghost text-sm"
                                        onClick={clearCoordinates}
                                        disabled={!formData.locationLatitude && !formData.locationLongitude}
                                    >
                                        Clear coordinates
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    Providing coordinates unlocks map displays and nearby discovery.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Search for a place
                                </label>
                                <input
                                    type="text"
                                    value={locationSearch}
                                    onChange={(e) => setLocationSearch(e.target.value)}
                                    className="input"
                                    placeholder="Type a venue, city, or address"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Pick a suggestion to autofill the address and coordinates.
                                </p>
                                <div className="mt-2 space-y-2">
                                    {locationQueryActive && locationSuggestionsLoading && (
                                        <div className="text-xs text-gray-500">Searching for places…</div>
                                    )}
                                    {locationQueryActive && !locationSuggestionsLoading && locationSuggestions.length === 0 && (
                                        <div className="text-xs text-gray-400">
                                            No matching places yet. Keep typing for better results.
                                        </div>
                                    )}
                                    {locationSuggestions.map((suggestion) => (
                                        <button
                                            key={suggestion.id}
                                            type="button"
                                            onClick={() => handleSuggestionSelect(suggestion)}
                                            className="w-full text-left border border-gray-200 rounded-lg p-3 hover:border-blue-400 transition-colors"
                                        >
                                            <div className="font-medium text-gray-900">{suggestion.label}</div>
                                            {suggestion.hint && (
                                                <div className="text-xs text-gray-500">{suggestion.hint}</div>
                                            )}
                                            <div className="text-xs text-gray-400 mt-1">
                                                {suggestion.latitude.toFixed(4)}, {suggestion.longitude.toFixed(4)}
                                            </div>
                                        </button>
                                    ))}
                                    {locationSuggestionsError && (
                                        <div className="text-xs text-red-500">{locationSuggestionsError}</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Event URL
                            </label>
                            <input
                                type="url"
                                value={formData.url}
                                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                className="input"
                                placeholder="https://..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Visibility
                            </label>
                            <div className="grid gap-2">
                                {VISIBILITY_OPTIONS.map((option) => {
                                    const selected = formData.visibility === option.value
                                    return (
                                        <label
                                            key={option.value}
                                            className={`flex gap-3 border rounded-lg p-3 cursor-pointer transition-colors ${selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-200'}`}
                                        >
                                            <input
                                                type="radio"
                                                name="visibility"
                                                value={option.value}
                                                checked={selected}
                                                onChange={() => setFormData({ ...formData, visibility: option.value })}
                                                className="sr-only"
                                            />
                                            <div>
                                                <div className="font-medium text-gray-900">{option.label}</div>
                                                <div className="text-sm text-gray-500">{option.description}</div>
                                            </div>
                                        </label>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="border-t border-gray-200 pt-4">
                            <label className="block text-sm font-medium mb-2">
                                Recurrence
                            </label>
                            <select
                                className="input"
                                value={formData.recurrencePattern}
                                onChange={(e) => {
                                    const value = e.target.value
                                    setFormData({
                                        ...formData,
                                        recurrencePattern: value,
                                        recurrenceEndDate: value ? formData.recurrenceEndDate : '',
                                    })
                                }}
                            >
                                <option value="">Does not repeat</option>
                                <option value="DAILY">Daily</option>
                                <option value="WEEKLY">Weekly</option>
                                <option value="MONTHLY">Monthly</option>
                            </select>
                            {formData.recurrencePattern && (
                                <div className="mt-4">
                                    <label className="block text-sm font-medium mb-2">
                                        Repeat until
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.recurrenceEndDate}
                                        onChange={(e) => setFormData({ ...formData, recurrenceEndDate: e.target.value })}
                                        min={formData.startTime ? formData.startTime.split('T')[0] : undefined}
                                        className="input"
                                    />
                                    <p className="text-xs text-gray-500 mt-2">
                                        Recurring events show on the calendar up to this date.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Tags
                            </label>
                            <div className="space-y-2">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={tagInput}
                                        onChange={(e) => {
                                            setTagInput(e.target.value)
                                            setTagError(null)
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault()
                                                addTag()
                                            }
                                        }}
                                        className={`input flex-1 ${tagError ? 'border-red-500' : ''}`}
                                        placeholder="Add a tag (press Enter)"
                                    />
                                    <button
                                        type="button"
                                        onClick={addTag}
                                        className="btn btn-secondary"
                                    >
                                        Add
                                    </button>
                                </div>
                                {tagError && (
                                    <p className="text-xs text-red-500">{tagError}</p>
                                )}
                                {formData.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {formData.tags.map((tag) => (
                                            <span
                                                key={tag}
                                                className="badge badge-primary flex items-center gap-1"
                                            >
                                                #{tag}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setFormData({
                                                            ...formData,
                                                            tags: formData.tags.filter((t) => t !== tag),
                                                        })
                                                    }}
                                                    className="ml-1 hover:text-red-600"
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <p className="text-xs text-gray-500">
                                    Add tags to help others discover your event
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="btn btn-primary flex-1"
                            >
                                {submitting ? 'Creating...' : 'Create Event'}
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="btn btn-secondary"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
