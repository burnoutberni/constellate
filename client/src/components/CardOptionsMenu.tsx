import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button, Modal } from '@/components/ui'
import { useDeleteEvent } from '@/hooks/queries'
import { useAuth } from '@/hooks/useAuth'
import type { Event } from '@/types'

import { ReportContentModal } from './ReportContentModal'

interface CardOptionsMenuProps {
    event: Event
    onOpenChange?: (isOpen: boolean) => void
}

export function CardOptionsMenu({ event, onOpenChange }: CardOptionsMenuProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isReportOpen, setIsReportOpen] = useState(false)
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
    const { user } = useAuth()
    const navigate = useNavigate()
    const { mutate: deleteEvent } = useDeleteEvent(event.id)
    const isOwner = Boolean(user?.id) && user?.id === event.user?.id

    // Sync external open handler
    React.useEffect(() => {
        onOpenChange?.(isOpen)
    }, [isOpen, onOpenChange])

    const toggleMenu = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsOpen(!isOpen)
    }

    const handleEdit = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsOpen(false)
        navigate(`/events/${event.id}/edit`)
    }

    const handleDelete = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsOpen(false)
        setIsDeleteConfirmOpen(true)
    }

    const confirmDelete = () => {
        if (user?.id) {
            deleteEvent(user.id)
        }
        setIsDeleteConfirmOpen(false)
    }

    return (
        <div className="relative inline-block text-left z-30">
            <Button
                variant="ghost"
                size="sm"
                type="button"
                className="h-8 w-8 p-0 rounded-full hover:bg-background-tertiary text-text-secondary"
                onClick={toggleMenu}
            >
                <span className="sr-only">Open options</span>
                <span className="text-lg leading-none">⋮</span>
            </Button>

            {isOpen && (
                <div
                    className="absolute right-0 mt-2 w-48 origin-top-right rounded-lg bg-background-primary shadow-xl ring-1 ring-border-default focus:outline-none border border-border-default overflow-hidden"
                    role="menu"
                    onMouseLeave={() => setIsOpen(false)}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <div className="p-1">
                        {isOwner ? (
                            <>
                                <button
                                    type="button"
                                    className="text-text-primary group flex w-full items-center px-4 py-2 text-sm hover:bg-background-secondary text-left transition-colors"
                                    onClick={handleEdit}
                                >
                                    <span className="mr-3">✏️</span> Edit Event
                                </button>
                                <button
                                    type="button"
                                    className="text-error-600 dark:text-error-400 group flex w-full items-center px-4 py-2 text-sm hover:bg-background-secondary text-left transition-colors"
                                    onClick={handleDelete}
                                >
                                    <span className="mr-3">🗑️</span> Delete Event
                                </button>
                            </>
                        ) : (
                            <button
                                type="button"
                                className="text-text-primary group flex w-full items-center px-4 py-2 text-sm hover:bg-background-secondary text-left transition-colors"
                                onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    setIsReportOpen(true)
                                    setIsOpen(false)
                                }}
                            >
                                <span className="mr-3">🚩</span> Report Event
                            </button>
                        )}
                    </div>
                </div>
            )}

            <ReportContentModal
                isOpen={isReportOpen}
                onClose={() => setIsReportOpen(false)}
                targetType="event"
                targetId={event.id}
                contentTitle={event.title}
            />

            <Modal
                isOpen={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                className="max-w-md"
            >
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-text-primary">Delete Event?</h3>
                    <p className="text-sm text-text-secondary">
                        Are you sure you want to delete <span className="font-semibold">{event.title}</span>? This action cannot be undone.
                    </p>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button
                            variant="ghost"
                            onClick={() => setIsDeleteConfirmOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            className="bg-error-600 hover:bg-error-700 text-white"
                            onClick={confirmDelete}
                        >
                            Delete Event
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
