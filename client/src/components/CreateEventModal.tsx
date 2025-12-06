import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import type { EventVisibility } from '../types'
import { VISIBILITY_OPTIONS } from '../lib/visibility'

interface CreateEventModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

const MAX_TAG_LENGTH = 50

// Helper function to normalize tag input
const normalizeTagInput = (input: string): string => {
    return input.trim().replace(/^#/, '').toLowerCase()
}

interface EventTemplate {
    id: string
    name: string
    description?: string | null
    data: {
        title?: string
        summary?: string
        location?: string
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
        url: '',
        startTime: '',
        endTime: '',
        visibility: 'PUBLIC',
        recurrencePattern: '',
        recurrenceEndDate: '',
        tags: [] as string[],
    })
    const [tagInput, setTagInput] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [templates, setTemplates] = useState<EventTemplate[]>([])
    const [templatesLoading, setTemplatesLoading] = useState(false)
    const [templateError, setTemplateError] = useState<string | null>(null)
    const [selectedTemplateId, setSelectedTemplateId] = useState('')
    const [saveAsTemplate, setSaveAsTemplate] = useState(false)
    const [templateName, setTemplateName] = useState('')
    const [templateDescription, setTemplateDescription] = useState('')

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
                url: '',
                startTime: '',
                endTime: '',
                visibility: 'PUBLIC',
                recurrencePattern: '',
                recurrenceEndDate: '',
                tags: [],
            })
            setTagInput('')
            setSelectedTemplateId('')
            setSaveAsTemplate(false)
            setTemplateName('')
            setTemplateDescription('')
            setError(null)
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        if (!user) {
            setError('You must be signed in to create an event.')
            return
        }
        try {
            setSubmitting(true)

            if (formData.recurrencePattern && !formData.recurrenceEndDate) {
                setError('Please choose when the recurring event should stop.')
                setSubmitting(false)
                return
            }

            if (formData.recurrencePattern && formData.recurrenceEndDate) {
                const startDate = new Date(formData.startTime)
                // Parse recurrence end date as end of day in UTC to avoid timezone issues
                const recurrenceEndDateStr = formData.recurrenceEndDate
                const recurrenceEnd = new Date(recurrenceEndDateStr + 'T23:59:59.999Z')
                if (Number.isNaN(startDate.getTime()) || Number.isNaN(recurrenceEnd.getTime())) {
                    setError('Please provide valid dates for recurring events.')
                    setSubmitting(false)
                    return
                }
                // Compare only the date parts (without time) to match backend validation
                const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
                const recurrenceEndDateOnly = new Date(recurrenceEnd.getFullYear(), recurrenceEnd.getMonth(), recurrenceEnd.getDate())
                // Backend requires recurrence end date to be strictly after start time
                if (recurrenceEndDateOnly <= startDateOnly) {
                    setError('Recurrence end date must be after the start date.')
                    setSubmitting(false)
                    return
                }
            }

            const payload: Record<string, unknown> = {
                title: formData.title,
                summary: formData.summary,
                location: formData.location,
                url: formData.url,
                startTime: new Date(formData.startTime).toISOString(),
                endTime: formData.endTime ? new Date(formData.endTime).toISOString() : undefined,
                visibility: formData.visibility,
            }

            if (formData.recurrencePattern) {
                payload.recurrencePattern = formData.recurrencePattern
                // Use the same end-of-day parsing logic as validation to ensure consistency (UTC)
                payload.recurrenceEndDate = new Date(formData.recurrenceEndDate + 'T23:59:59.999Z').toISOString()
            }
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
                if (saveAsTemplate) {
                    try {
                        await saveTemplateFromEvent({
                            title: formData.title,
                            summary: formData.summary,
                            location: formData.location,
                            url: formData.url,
                            startTime: new Date(formData.startTime).toISOString(),
                            endTime: formData.endTime ? new Date(formData.endTime).toISOString() : undefined,
                        })
                    } catch (err) {
                        console.error('Failed to save template', err)
                        window.alert('Your event was created, but saving the template failed. You can try again later from the event details page.')
                    }
                }
                setFormData({
                    title: '',
                    summary: '',
                    location: '',
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
                onSuccess()
                onClose()
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

                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Location
                            </label>
                            <input
                                type="text"
                                value={formData.location}
                                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                className="input"
                                placeholder="Conference Room A"
                            />
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
                                        onChange={(e) => setTagInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && tagInput.trim()) {
                                                e.preventDefault()
                                                const tag = normalizeTagInput(tagInput)
                                                if (tag && tag.length <= MAX_TAG_LENGTH && !formData.tags.includes(tag)) {
                                                    setFormData({ ...formData, tags: [...formData.tags, tag] })
                                                    setTagInput('')
                                                }
                                            }
                                        }}
                                        className="input flex-1"
                                        placeholder="Add a tag (press Enter)"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (tagInput.trim()) {
                                                const tag = normalizeTagInput(tagInput)
                                                if (tag && tag.length <= MAX_TAG_LENGTH && !formData.tags.includes(tag)) {
                                                    setFormData({ ...formData, tags: [...formData.tags, tag] })
                                                    setTagInput('')
                                                }
                                            }
                                        }}
                                        className="btn btn-secondary"
                                    >
                                        Add
                                    </button>
                                </div>
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
