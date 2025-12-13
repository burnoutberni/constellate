import { useState } from 'react'

import { Card, Button, Badge } from './ui'

export interface EventTemplate {
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
	createdAt: string
	updatedAt: string
}

interface TemplateCardProps {
	template: EventTemplate
	onEdit: (template: EventTemplate) => void
	onDelete: (templateId: string) => void
	onPreview: (template: EventTemplate) => void
	onUse: (template: EventTemplate) => void
}

export function TemplateCard({ template, onEdit, onDelete, onPreview, onUse }: TemplateCardProps) {
	const [isDeleting, setIsDeleting] = useState(false)
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

	const handleDelete = async () => {
		setIsDeleting(true)
		try {
			await onDelete(template.id)
		} finally {
			setIsDeleting(false)
			setShowDeleteConfirm(false)
		}
	}

	return (
		<Card variant="outlined" padding="md" className="hover:shadow-md transition-shadow">
			<div className="space-y-3">
				<div className="flex items-start justify-between">
					<div className="flex-1">
						<h3 className="text-lg font-semibold text-neutral-900">{template.name}</h3>
						{template.description && (
							<p className="text-sm text-neutral-600 mt-1">{template.description}</p>
						)}
					</div>
				</div>

				{/* Template preview data */}
				<div className="space-y-2 text-sm">
					{template.data.title && (
						<div>
							<span className="font-medium text-neutral-700">Title: </span>
							<span className="text-neutral-600">{template.data.title}</span>
						</div>
					)}
					{template.data.location && (
						<div>
							<span className="font-medium text-neutral-700">Location: </span>
							<span className="text-neutral-600">{template.data.location}</span>
						</div>
					)}
					{template.data.url && (
						<div>
							<span className="font-medium text-neutral-700">URL: </span>
							<a
								href={template.data.url}
								target="_blank"
								rel="noopener noreferrer"
								className="text-primary-600 hover:underline">
								{template.data.url}
							</a>
						</div>
					)}
					{template.data.summary && (
						<div>
							<span className="font-medium text-neutral-700">Description: </span>
							<span className="text-neutral-600 line-clamp-2">
								{template.data.summary}
							</span>
						</div>
					)}
				</div>

				{/* Metadata */}
				<div className="flex items-center gap-2 text-xs text-neutral-500">
					<Badge variant="default" size="sm">
						Updated {new Date(template.updatedAt).toLocaleDateString()}
					</Badge>
					{template.data.locationLatitude !== undefined &&
						template.data.locationLongitude !== undefined && (
							<Badge variant="default" size="sm">
								Has Coordinates
							</Badge>
						)}
				</div>

				{/* Actions */}
				{!showDeleteConfirm ? (
					<div className="flex gap-2 pt-2">
						<Button
							variant="primary"
							size="sm"
							onClick={() => onUse(template)}
							className="flex-1">
							Use Template
						</Button>
						<Button variant="ghost" size="sm" onClick={() => onPreview(template)}>
							Preview
						</Button>
						<Button variant="ghost" size="sm" onClick={() => onEdit(template)}>
							Edit
						</Button>
						<Button
							variant="danger"
							size="sm"
							onClick={() => setShowDeleteConfirm(true)}>
							Delete
						</Button>
					</div>
				) : (
					<div className="bg-error-50 border border-error-200 rounded-lg p-3">
						<p className="text-sm text-error-700 mb-2">
							Are you sure you want to delete this template? This action cannot be
							undone.
						</p>
						<div className="flex gap-2">
							<Button
								variant="danger"
								size="sm"
								onClick={handleDelete}
								disabled={isDeleting}
								className="flex-1">
								{isDeleting ? 'Deleting...' : 'Yes, Delete'}
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setShowDeleteConfirm(false)}
								disabled={isDeleting}>
								Cancel
							</Button>
						</div>
					</div>
				)}
			</div>
		</Card>
	)
}
