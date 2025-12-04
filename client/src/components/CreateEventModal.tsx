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
        recurrencePattern: '',
        recurrenceEndDate: '',
    })
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

            if (formData.recurrencePattern && !formData.recurrenceEndDate) {
                setError('Please choose when the recurring event should stop.')
                return
            }

            if (formData.recurrencePattern && formData.recurrenceEndDate) {
                const startDate = new Date(formData.startTime)
                const recurrenceEnd = new Date(formData.recurrenceEndDate)
                if (Number.isNaN(startDate.getTime()) || Number.isNaN(recurrenceEnd.getTime())) {
                    setError('Please provide valid dates for recurring events.')
                    return
                }
                if (recurrenceEnd <= startDate) {
                    setError('Recurrence end date must be after the start time.')
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
            }

            if (formData.recurrencePattern) {
                payload.recurrencePattern = formData.recurrencePattern
                payload.recurrenceEndDate = new Date(formData.recurrenceEndDate).toISOString()
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
                setFormData({
                    title: '',
                    summary: '',
                    location: '',
                    url: '',
                    startTime: '',
                    endTime: '',
                    recurrencePattern: '',
                    recurrenceEndDate: '',
                })
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
                                        Repeat until *
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
