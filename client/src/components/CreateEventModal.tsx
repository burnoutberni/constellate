import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import type { EventVisibility } from '@/types'
import { useLocationSuggestions, LocationSuggestion, MIN_QUERY_LENGTH } from '../hooks/useLocationSuggestions'
import { validateRecurrence, parseCoordinates, buildEventPayload as buildEventPayloadUtil } from '../lib/eventFormUtils'
import { useUIStore } from '@/stores'
import { useEventDraft } from '../hooks/useEventDraft'
import { Button, Input, Textarea, Card } from './ui'
import { RecurrenceSelector } from './RecurrenceSelector'
import { VisibilitySelector } from './VisibilitySelector'
import { TemplateSelector, type EventTemplate } from './TemplateSelector'

interface CreateEventModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    initialTemplateId?: string
}

const MAX_TAG_LENGTH = 50

// Geolocation timeout in milliseconds (10 seconds)
// This provides sufficient time for high-accuracy location while preventing indefinite waits
const GEO_TIMEOUT_MS = 10000

// Coordinate precision: 6 decimal places provides approximately 0.1 meter precision
// This is sufficient for most event location needs while keeping coordinate strings manageable
const COORDINATE_DECIMAL_PLACES = 6

// Helper function to normalize tag input
const normalizeTagInput = (input: string): string => input.trim().replace(/^#+/, '').trim().toLowerCase()

export function CreateEventModal({ isOpen, onClose, onSuccess, initialTemplateId }: CreateEventModalProps) {
    const { user } = useAuth()
    const addErrorToast = useUIStore((state) => state.addErrorToast)
    const { saveDraft, loadDraft, clearDraft, hasDraft } = useEventDraft()
    const [error, setError] = useState<string | null>(null)
    const [showDraftPrompt, setShowDraftPrompt] = useState(false)
    const [formData, setFormData] = useState<{
        title: string
        summary: string
        location: string
        locationLatitude: string
        locationLongitude: string
        url: string
        headerImage: string
        timezone: string
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
        headerImage: '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
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

        setFormData((prev) => {
            if (!prev.tags.includes(tag)) {
                setTagInput('')
                return { ...prev, tags: [...prev.tags, tag] }
            }
                setTagError('This tag has already been added')
                return prev
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

    // Load draft when modal opens
    useEffect(() => {
        if (isOpen && hasDraft()) {
            setShowDraftPrompt(true)
        }
    }, [isOpen, hasDraft])

    // Auto-save draft every few seconds when form has content
    useEffect(() => {
        if (!isOpen) {
return
}

        const autoSaveInterval = setInterval(() => {
            saveDraft(formData)
        }, 3000) // Auto-save every 3 seconds

        return () => clearInterval(autoSaveInterval)
    }, [isOpen, formData, saveDraft])

    useEffect(() => {
        if (!isOpen) {
            // Reset form when modal closes (but don't clear draft)
            setFormData({
                title: '',
                summary: '',
                location: '',
                locationLatitude: '',
                locationLongitude: '',
                url: '',
                headerImage: '',
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
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
            setShowDraftPrompt(false)
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

    const handleLoadDraft = () => {
        const draft = loadDraft()
        if (draft) {
            setFormData(draft as typeof formData)
            setShowDraftPrompt(false)
        }
    }

    const handleDiscardDraft = () => {
        clearDraft()
        setShowDraftPrompt(false)
    }

    const applyTemplate = useCallback((templateId: string) => {
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
            headerImage: template.data.headerImage || '',
            timezone: template.data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
            startTime: template.data.startTime || '',
            endTime: template.data.endTime || '',
            visibility: (template.data.visibility as EventVisibility) || 'PUBLIC',
            recurrencePattern: template.data.recurrencePattern || 'none',
            recurrenceEndDate: template.data.recurrenceEndDate || '',
            tags: template.data.tags || [],
        })
    }, [templates])

    // Apply initial template if provided
    useEffect(() => {
        if (initialTemplateId && templates.length > 0 && isOpen) {
            const template = templates.find((t) => t.id === initialTemplateId)
            if (template && selectedTemplateId !== initialTemplateId) {
                applyTemplate(initialTemplateId)
            }
        }
    }, [initialTemplateId, templates, isOpen, selectedTemplateId, applyTemplate])

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

    const refreshTemplates = async () => {
        if (!user) {
return
}
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
            headerImage: '',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
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
                // the current form's tags are preserved (see applyTemplate function above).
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
                addErrorToast({ id: crypto.randomUUID(), message: 'Your event was created, but saving the template failed. You can try again later from the event details page.' })
            }
        }
        clearDraft() // Clear draft after successful creation
        resetForm()
        onSuccess()
        onClose()
    }

    const handleSubmit = async (e: FormEvent) => {
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

            const coordinateResult = parseCoordinates(formData)
            if ('error' in coordinateResult) {
                setError(coordinateResult.error)
                setSubmitting(false)
                return
            }

            const payload = buildEventPayloadUtil(
                formData,
                'latitude' in coordinateResult ? coordinateResult.latitude : undefined,
                'longitude' in coordinateResult ? coordinateResult.longitude : undefined,
            )
            const response = await fetch('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    ...payload,
                    tags: formData.tags.length > 0 ? formData.tags : undefined,
                    headerImage: formData.headerImage.trim() || undefined,
                    timezone: formData.timezone,
                }),
            })

            if (response.ok) {
                const hasCoordinates = 'latitude' in coordinateResult && 'longitude' in coordinateResult
                await handleSuccessfulSubmission(
                    hasCoordinates ? coordinateResult.latitude : undefined,
                    hasCoordinates ? coordinateResult.longitude : undefined,
                )
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Create Event</h2>
                        <button
                            onClick={onClose}
                            className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 text-2xl"
                            aria-label="Close modal"
                        >
                            ×
                        </button>
                    </div>
                    {error && (
                        <div className="bg-error-50 dark:bg-error-900/20 text-error-600 dark:text-error-400 p-3 rounded-lg mb-4 text-sm">
                            {error}
                        </div>
                    )}
                    {showDraftPrompt && (
                        <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 p-4 rounded-lg mb-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                    <h3 className="text-sm font-semibold text-primary-900 dark:text-primary-100 mb-1">
                                        Resume draft?
                                    </h3>
                                    <p className="text-sm text-primary-700 dark:text-primary-300">
                                        You have an unsaved draft from a previous session. Would you like to continue where you left off?
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant="primary"
                                        size="sm"
                                        onClick={handleLoadDraft}
                                    >
                                        Resume
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleDiscardDraft}
                                    >
                                        Discard
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                    {user && (
                        <div className="mb-4">
                            <TemplateSelector
                                templates={templates}
                                selectedId={selectedTemplateId}
                                onSelect={applyTemplate}
                                onRefresh={refreshTemplates}
                                loading={templatesLoading}
                                error={templateError}
                            />
                        </div>
                    )}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input
                            type="text"
                            label="Event Title"
                            required
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="Team Meeting"
                            fullWidth
                        />

                        <Textarea
                            label="Description"
                            value={formData.summary}
                            onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                            rows={4}
                            placeholder="What's this event about?"
                            fullWidth
                        />

                        <div className="grid md:grid-cols-2 gap-4">
                            <Input
                                type="datetime-local"
                                label="Start Date & Time"
                                required
                                value={formData.startTime}
                                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                fullWidth
                            />

                            <Input
                                type="datetime-local"
                                label="End Date & Time"
                                value={formData.endTime}
                                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                fullWidth
                            />
                        </div>

                        <div className="space-y-4">
                            <Input
                                type="text"
                                label="Location label"
                                value={formData.location}
                                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                placeholder="Conference Room A"
                                helperText="This text is shown on cards and detail pages (e.g., venue or meeting link)."
                                fullWidth
                            />

                            <div>
                                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                                    Coordinates (for map & nearby search)
                                </label>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <Input
                                        type="number"
                                        label="Latitude"
                                        step="0.000001"
                                        value={formData.locationLatitude}
                                        onChange={(e) => setFormData({ ...formData, locationLatitude: e.target.value })}
                                        placeholder="40.7128"
                                        fullWidth
                                    />
                                    <Input
                                        type="number"
                                        label="Longitude"
                                        step="0.000001"
                                        value={formData.locationLongitude}
                                        onChange={(e) => setFormData({ ...formData, locationLongitude: e.target.value })}
                                        placeholder="-74.0060"
                                        fullWidth
                                    />
                                </div>
                                <div className="flex flex-wrap gap-3 mt-2">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={handleUseCurrentLocation}
                                        disabled={geoLoading}
                                    >
                                        {geoLoading ? 'Locating…' : 'Use my location'}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={clearCoordinates}
                                        disabled={!formData.locationLatitude && !formData.locationLongitude}
                                    >
                                        Clear coordinates
                                    </Button>
                                </div>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                                    Providing coordinates unlocks map displays and nearby discovery.
                                </p>
                            </div>

                            <Input
                                type="text"
                                label="Search for a place"
                                value={locationSearch}
                                onChange={(e) => setLocationSearch(e.target.value)}
                                placeholder="Type a venue, city, or address"
                                helperText="Pick a suggestion to autofill the address and coordinates."
                                fullWidth
                            />
                            <div className="space-y-2 -mt-2">
                                {locationQueryActive && locationSuggestionsLoading && (
                                    <div className="text-xs text-neutral-500 dark:text-neutral-400">Searching for places…</div>
                                )}
                                {locationQueryActive && !locationSuggestionsLoading && locationSuggestions.length === 0 && (
                                    <div className="text-xs text-neutral-400 dark:text-neutral-500">
                                        No matching places yet. Keep typing for better results.
                                    </div>
                                )}
                                {locationSuggestions.map((suggestion) => (
                                    <button
                                        key={suggestion.id}
                                        type="button"
                                        onClick={() => handleSuggestionSelect(suggestion)}
                                        className="w-full text-left border border-neutral-200 dark:border-neutral-700 rounded-lg p-3 hover:border-primary-400 dark:hover:border-primary-600 transition-colors"
                                    >
                                        <div className="font-medium text-neutral-900 dark:text-neutral-100">{suggestion.label}</div>
                                        {suggestion.hint && (
                                            <div className="text-xs text-neutral-500 dark:text-neutral-400">{suggestion.hint}</div>
                                        )}
                                        <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                                            {suggestion.latitude.toFixed(4)}, {suggestion.longitude.toFixed(4)}
                                        </div>
                                    </button>
                                ))}
                                {locationSuggestionsError && (
                                    <div className="text-xs text-error-500 dark:text-error-400">{locationSuggestionsError}</div>
                                )}
                            </div>
                        </div>

                        <Input
                            type="url"
                            label="Event URL"
                            value={formData.url}
                            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                            placeholder="https://..."
                            helperText="Link to event website, video call, or registration page"
                            fullWidth
                        />

                        <Input
                            type="url"
                            label="Header Image URL"
                            value={formData.headerImage}
                            onChange={(e) => setFormData({ ...formData, headerImage: e.target.value })}
                            placeholder="https://example.com/image.jpg"
                            helperText="Optional image to display at the top of the event page"
                            fullWidth
                        />

                        <div>
                            <label htmlFor="timezone" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                                Timezone
                            </label>
                            <select
                                id="timezone"
                                value={formData.timezone}
                                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            >
                                {(() => {
                                    // Try to use the modern API if available
                                    const intl = Intl as typeof Intl & {
                                        supportedValuesOf?: (type: 'timeZone') => string[]
                                    }
                                    if (typeof intl.supportedValuesOf === 'function') {
                                        try {
                                            return intl.supportedValuesOf('timeZone').map((tz: string) => (
                                                <option key={tz} value={tz}>
                                                    {tz}
                                                </option>
                                            ))
                                        } catch (timezoneError) {
                                            console.error('Failed to load timezones:', timezoneError)
                                        }
                                    }
                                    // Fallback to common timezones
                                    const commonTimezones = [
                                        'UTC',
                                        'America/New_York',
                                        'America/Chicago',
                                        'America/Denver',
                                        'America/Los_Angeles',
                                        'America/Toronto',
                                        'Europe/London',
                                        'Europe/Paris',
                                        'Europe/Berlin',
                                        'Asia/Tokyo',
                                        'Asia/Shanghai',
                                        'Australia/Sydney',
                                    ]
                                    return commonTimezones.map((tz) => (
                                        <option key={tz} value={tz}>
                                            {tz}
                                        </option>
                                    ))
                                })()}
                            </select>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                                The timezone for event start and end times
                            </p>
                        </div>

                        <VisibilitySelector
                            value={formData.visibility}
                            onChange={(visibility) => setFormData({ ...formData, visibility })}
                        />

                        <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4">
                            <RecurrenceSelector
                                value={{
                                    pattern: formData.recurrencePattern as '' | 'DAILY' | 'WEEKLY' | 'MONTHLY',
                                    endDate: formData.recurrenceEndDate,
                                }}
                                onChange={(recurrence) => setFormData({
                                    ...formData,
                                    recurrencePattern: recurrence.pattern,
                                    recurrenceEndDate: recurrence.endDate,
                                })}
                                startTime={formData.startTime}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                                Tags
                            </label>
                            <div className="space-y-2">
                                <div className="flex gap-2">
                                    <Input
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
                                        error={Boolean(tagError)}
                                        errorMessage={tagError || undefined}
                                        placeholder="Add a tag (press Enter)"
                                        fullWidth
                                    />
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={addTag}
                                    >
                                        Add
                                    </Button>
                                </div>
                                {formData.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {formData.tags.map((tag) => (
                                            <span
                                                key={tag}
                                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm"
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
                                                    className="ml-1 hover:text-error-600 dark:hover:text-error-400"
                                                    aria-label={`Remove ${tag} tag`}
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                    Add tags to help others discover your event
                                </p>
                            </div>
                        </div>

                        {user && (
                            <div className="border-t border-gray-200 pt-4">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={saveAsTemplate}
                                        onChange={(e) => setSaveAsTemplate(e.target.checked)}
                                        className="mt-1 h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                                    />
                                    <div className="flex-1">
                                        <span className="text-sm font-medium text-gray-900">Save as template</span>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Save this event configuration as a reusable template (excludes dates and tags)
                                        </p>
                                    </div>
                                </label>
                                {saveAsTemplate && (
                                    <div className="mt-4 space-y-3 pl-7">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Template Name
                                            </label>
                                            <input
                                                type="text"
                                                value={templateName}
                                                onChange={(e) => setTemplateName(e.target.value)}
                                                className="input"
                                                placeholder={formData.title || 'My Event Template'}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Template Description (optional)
                                            </label>
                                            <textarea
                                                value={templateDescription}
                                                onChange={(e) => setTemplateDescription(e.target.value)}
                                                className="textarea"
                                                rows={2}
                                                placeholder="Describe this template"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex gap-3 pt-4">
                            <Button
                                type="submit"
                                variant="primary"
                                disabled={submitting}
                                loading={submitting}
                                fullWidth
                            >
                                {submitting ? 'Creating...' : 'Create Event'}
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={onClose}
                            >
                                Cancel
                            </Button>
                        </div>
                    </form>
                </div>
            </Card>
        </div>
    )
}
