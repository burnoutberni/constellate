import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

interface CreateEventModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
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
    const [formData, setFormData] = useState({
        title: '',
        summary: '',
        location: '',
        url: '',
        startTime: '',
        endTime: '',
    })
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
            const payload = {
                ...formData,
                startTime: new Date(formData.startTime).toISOString(),
                endTime: formData.endTime ? new Date(formData.endTime).toISOString() : undefined,
            }
            const response = await fetch('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(payload),
            })
            if (response.ok) {
                if (saveAsTemplate) {
                    try {
                        await saveTemplateFromEvent(payload)
                    } catch (err) {
                        console.error('Failed to save template', err)
                        window.alert('Your event was created, but saving the template failed. You can try again later from the event details page.')
                    }
                }
                const emptyForm = {
                    title: '',
                    summary: '',
                    location: '',
                    url: '',
                    startTime: '',
                    endTime: '',
                }
                setFormData(emptyForm)
                setSaveAsTemplate(false)
                setSelectedTemplateId('')
                setTemplateName('')
                setTemplateDescription('')
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

                        <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                            <label className="flex items-start gap-3 text-sm">
                                <input
                                    type="checkbox"
                                    className="mt-1"
                                    checked={saveAsTemplate}
                                    onChange={(event) => setSaveAsTemplate(event.target.checked)}
                                />
                                <span>
                                    <span className="font-medium">Save as template</span>
                                    <span className="block text-xs text-gray-500">
                                        Keep these settings available for the next event you create.
                                    </span>
                                </span>
                            </label>
                            {saveAsTemplate && (
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium mb-1">
                                            Template Name *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={templateName}
                                            onChange={(event) => setTemplateName(event.target.value)}
                                            className="input"
                                            placeholder="Weekly Standup"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1">
                                            Template Description
                                        </label>
                                        <textarea
                                            value={templateDescription}
                                            onChange={(event) => setTemplateDescription(event.target.value)}
                                            className="textarea"
                                            rows={2}
                                            placeholder="Share context for teammates"
                                        />
                                    </div>
                                </div>
                            )}
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
