import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

interface CreateEventModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

export function CreateEventModal({ isOpen, onClose, onSuccess }: CreateEventModalProps) {
        const { user } = useAuth() || {}
        const [error, setError] = useState<string | null>(null)
    const [formData, setFormData] = useState({
        title: '',
        summary: '',
        location: '',
        url: '',
        startTime: '',
        endTime: '',
        tags: [] as string[],
        recurrencePattern: '' as '' | 'daily' | 'weekly' | 'monthly' | 'yearly',
        recurrenceEndDate: '',
    })
    const [tagInput, setTagInput] = useState('')
    const [submitting, setSubmitting] = useState(false)

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        if (!user) {
            setError('You must be signed in to create an event.')
            return
        }
        try {
            setSubmitting(true)
            const response = await fetch('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    ...formData,
                    startTime: new Date(formData.startTime).toISOString(),
                    endTime: formData.endTime ? new Date(formData.endTime).toISOString() : undefined,
                    tags: formData.tags.length > 0 ? formData.tags : undefined,
                    recurrencePattern: formData.recurrencePattern || undefined,
                    recurrenceEndDate: formData.recurrenceEndDate ? new Date(formData.recurrenceEndDate).toISOString() : undefined,
                }),
            })
            if (response.ok) {
                setFormData({
                    title: '',
                    summary: '',
                    location: '',
                    url: '',
                    startTime: '',
                    endTime: '',
                    tags: [],
                    recurrencePattern: '',
                    recurrenceEndDate: '',
                })
                setTagInput('')
                onSuccess()
                onClose()
            } else if (response.status === 401) {
                setError('Authentication required. Please sign in.')
            } else {
                setError('Failed to create event. Please try again.')
            }
        } catch (error) {
            setError('Error creating event. Please try again.')
            console.error('Error creating event:', error)
        } finally {
            setSubmitting(false)
        }
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
                                Recurrence
                            </label>
                            <div className="space-y-2">
                                <select
                                    value={formData.recurrencePattern}
                                    onChange={(e) => setFormData({ ...formData, recurrencePattern: e.target.value as typeof formData.recurrencePattern })}
                                    className="input"
                                >
                                    <option value="">No recurrence</option>
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                    <option value="yearly">Yearly</option>
                                </select>
                                {formData.recurrencePattern && (
                                    <div>
                                        <label className="block text-xs text-gray-600 mb-1">
                                            Recurrence End Date (optional)
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.recurrenceEndDate}
                                            onChange={(e) => setFormData({ ...formData, recurrenceEndDate: e.target.value })}
                                            className="input"
                                            min={formData.startTime ? formData.startTime.split('T')[0] : undefined}
                                        />
                                    </div>
                                )}
                            </div>
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
                                                const tag = tagInput.trim().toLowerCase().replace(/^#/, '')
                                                if (tag && !formData.tags.includes(tag)) {
                                                    setFormData({ ...formData, tags: [...formData.tags, tag] })
                                                    setTagInput('')
                                                }
                                            }
                                        }}
                                        className="input flex-1"
                                        placeholder="Type a tag and press Enter"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (tagInput.trim()) {
                                                const tag = tagInput.trim().toLowerCase().replace(/^#/, '')
                                                if (tag && !formData.tags.includes(tag)) {
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
                                        {formData.tags.map((tag, index) => (
                                            <span
                                                key={index}
                                                className="badge badge-primary flex items-center gap-1"
                                            >
                                                #{tag}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setFormData({
                                                            ...formData,
                                                            tags: formData.tags.filter((_, i) => i !== index),
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
