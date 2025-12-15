import { useRef, useEffect, useState } from 'react'

import { tokens } from '@/design-system'
import type { Event } from '@/types'

import { Stack } from './layout'
import { Button, Badge, SafeHTML } from './ui'

interface CalendarEventPopupProps {
	event: Event
	position: { x: number; y: number }
	onClose: () => void
	onNavigateToEvent: (eventId: string) => void
	onExportICS: (eventId: string) => void
	onExportGoogle: (eventId: string) => void
}

export function CalendarEventPopup({
	event,
	position,
	onClose,
	onNavigateToEvent,
	onExportICS,
	onExportGoogle,
}: CalendarEventPopupProps) {
	const popupRef = useRef<HTMLDivElement>(null)

	// Close on outside click
	useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
				onClose()
			}
		}

		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [onClose])

	// Close on escape key
	useEffect(() => {
		function handleEscape(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				onClose()
			}
		}

		document.addEventListener('keydown', handleEscape)
		return () => document.removeEventListener('keydown', handleEscape)
	}, [onClose])

	// Adjust position if popup goes off screen
	// Use spacing[5] (1.25rem = 20px) for viewport edge padding
	const viewportPadding = parseFloat(tokens.spacing[5]) * 16 // Convert rem to px
	const [adjustedPosition, setAdjustedPosition] = useState(position)

	useEffect(() => {
		if (popupRef.current) {
			const rect = popupRef.current.getBoundingClientRect()
			const viewportWidth = window.innerWidth
			const viewportHeight = window.innerHeight
			const newPosition = { ...position }

			if (rect.right > viewportWidth) {
				newPosition.x = viewportWidth - rect.width - viewportPadding
			}
			if (rect.bottom > viewportHeight) {
				newPosition.y = viewportHeight - rect.height - viewportPadding
			}
			// Use setTimeout to avoid synchronous setState in effect
			setTimeout(() => setAdjustedPosition(newPosition), 0)
		} else {
			// Use setTimeout to avoid synchronous setState in effect
			setTimeout(() => setAdjustedPosition(position), 0)
		}
	}, [position, viewportPadding])

	const formatDateTime = (dateString: string) => {
		const date = new Date(dateString)
		return date.toLocaleString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
		})
	}

	return (
		<>
			{/* Backdrop */}
			<div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

			{/* Popup */}
			<div
				ref={popupRef}
				className="fixed bg-background-primary border border-border-default rounded-lg shadow-xl z-50 max-w-md w-full"
				style={{
					left: `${adjustedPosition.x}px`,
					top: `${adjustedPosition.y}px`,
				}}
				role="dialog"
				aria-label="Event details">
				{/* Header Image */}
				{event.headerImage && (
					<img
						src={event.headerImage}
						alt=""
						className="w-full h-32 object-cover rounded-t-lg"
					/>
				)}

				<div className="p-4">
					{/* Title */}
					<h3 className="text-lg font-semibold text-text-primary mb-2">{event.title}</h3>

					{/* Date/Time */}
					<div className="flex items-start gap-2 text-sm text-text-secondary mb-2">
						<span className="flex-shrink-0">🗓️</span>
						<div>
							<div>{formatDateTime(event.startTime)}</div>
							{event.endTime && <div>to {formatDateTime(event.endTime)}</div>}
						</div>
					</div>

					{/* Location */}
					{event.location && (
						<div className="flex items-start gap-2 text-sm text-text-secondary mb-2">
							<span className="flex-shrink-0">📍</span>
							<span>{event.location}</span>
						</div>
					)}

					{/* Organizer */}
					{event.user && (
						<div className="flex items-center gap-2 text-sm text-text-secondary mb-2">
							<span className="flex-shrink-0">👤</span>
							<span>{event.user.name || event.user.username}</span>
						</div>
					)}

					{/* Summary */}
					{event.summary && (
						<div className="text-sm text-text-secondary mb-3 line-clamp-3">
							<SafeHTML html={event.summary} />
						</div>
					)}

					{/* Tags */}
					{event.tags && event.tags.length > 0 && (
						<div className="flex flex-wrap gap-1 mb-3">
							{event.tags.map((tag) => (
								<Badge key={tag.id} variant="secondary" size="sm">
									{tag.tag}
								</Badge>
							))}
						</div>
					)}

					{/* Stats */}
					{event._count && (
						<div className="flex gap-4 text-sm text-text-secondary mb-4">
							{event._count.attendance > 0 && (
								<span>👥 {event._count.attendance}</span>
							)}
							{event._count.likes > 0 && <span>❤️ {event._count.likes}</span>}
							{event._count.comments > 0 && <span>💬 {event._count.comments}</span>}
						</div>
					)}

					{/* Actions */}
					<Stack gap="sm">
						<Button
							variant="primary"
							size="sm"
							fullWidth
							onClick={() => onNavigateToEvent(event.id)}>
							View Full Details
						</Button>

						<div className="flex gap-2">
							<Button
								variant="secondary"
								size="sm"
								fullWidth
								onClick={() => onExportICS(event.id)}>
								Export ICS
							</Button>
							<Button
								variant="secondary"
								size="sm"
								fullWidth
								onClick={() => onExportGoogle(event.id)}>
								Add to Google
							</Button>
						</div>
					</Stack>
				</div>
			</div>
		</>
	)
}
