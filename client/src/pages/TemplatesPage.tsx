import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { PageLayout, Container } from '@/components/layout'
import { Button, Input, Textarea, Modal } from '@/components/ui'
import { queryKeys } from '@/hooks/queries'
import { api } from '@/lib/api-client'
import { extractErrorMessage } from '@/lib/errorHandling'
import { generateId } from '@/lib/utils'
import { useUIStore } from '@/stores'

import { Navbar } from '../components/Navbar'
import type { EventTemplate } from '../components/TemplateCard'
import { TemplateList } from '../components/TemplateList'
import { useAuth } from '../hooks/useAuth'

interface TemplatePreviewModalProps {
	template: EventTemplate | null
	onClose: () => void
}

function TemplatePreviewModal({ template, onClose }: TemplatePreviewModalProps) {
	if (!template) {
		return null
	}

	return (
		<Modal isOpen={Boolean(template)} onClose={onClose} maxWidth="2xl">
			<div className="bg-background-primary rounded-lg max-h-[90vh] overflow-y-auto">
				<div className="p-6">
					<div className="flex items-center justify-between mb-6">
						<h2 className="text-2xl font-bold text-text-primary">Template Preview</h2>
						<Button
							onClick={onClose}
							variant="ghost"
							size="sm"
							className="text-text-secondary hover:text-text-primary text-2xl h-auto p-0 min-w-0">
							×
						</Button>
					</div>

					<div className="space-y-4">
						<div>
							<h3 className="text-lg font-semibold text-text-primary">
								{template.name}
							</h3>
							{template.description && (
								<p className="text-sm text-text-secondary mt-1">
									{template.description}
								</p>
							)}
						</div>

						<div className="border-t border-border-default pt-4 space-y-3">
							<h4 className="font-medium text-text-primary">Template Data</h4>

							{template.data.title && (
								<div>
									<label className="block text-sm font-medium text-text-secondary">
										Event Title
									</label>
									<p className="mt-1 text-sm text-text-primary">
										{template.data.title}
									</p>
								</div>
							)}

							{template.data.summary && (
								<div>
									<label className="block text-sm font-medium text-text-secondary">
										Description
									</label>
									<p className="mt-1 text-sm text-text-primary">
										{template.data.summary}
									</p>
								</div>
							)}

							{template.data.location && (
								<div>
									<label className="block text-sm font-medium text-text-secondary">
										Location
									</label>
									<p className="mt-1 text-sm text-text-primary">
										{template.data.location}
									</p>
								</div>
							)}

							{template.data.locationLatitude !== undefined &&
								template.data.locationLongitude !== undefined && (
									<div>
										<label className="block text-sm font-medium text-text-secondary">
											Coordinates
										</label>
										<p className="mt-1 text-sm text-text-primary">
											{template.data.locationLatitude},{' '}
											{template.data.locationLongitude}
										</p>
									</div>
								)}

							{template.data.url && (
								<div>
									<label className="block text-sm font-medium text-text-secondary">
										Event URL
									</label>
									<p className="mt-1 text-sm text-text-primary">
										<a
											href={template.data.url}
											target="_blank"
											rel="noopener noreferrer"
											className="text-primary-600 hover:underline dark:text-primary-400">
											{template.data.url}
										</a>
									</p>
								</div>
							)}
						</div>

						<div className="border-t border-border-default pt-4">
							<Button variant="secondary" onClick={onClose} fullWidth>
								Close
							</Button>
						</div>
					</div>
				</div>
			</div>
		</Modal>
	)
}

interface TemplateEditModalProps {
	template: EventTemplate | null
	onClose: () => void
	onSave: (id: string, data: { name: string; description: string }) => Promise<void>
}

function TemplateEditModal({ template, onClose, onSave }: TemplateEditModalProps) {
	const [name, setName] = useState(template?.name || '')
	const [description, setDescription] = useState(template?.description || '')
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault()
		if (!template) {
			return
		}

		setError(null)
		setSaving(true)

		try {
			await onSave(template.id, { name: name.trim(), description: description.trim() })
			onClose()
		} catch (err) {
			setError(extractErrorMessage(err, 'Failed to update template'))
		} finally {
			setSaving(false)
		}
	}

	if (!template) {
		return null
	}

	return (
		<Modal isOpen={Boolean(template)} onClose={onClose} maxWidth="2xl">
			<div className="bg-background-primary rounded-lg max-h-[90vh] overflow-y-auto">
				<div className="p-6">
					<div className="flex items-center justify-between mb-6">
						<h2 className="text-2xl font-bold text-text-primary">Edit Template</h2>
						<Button
							onClick={onClose}
							variant="ghost"
							size="sm"
							className="text-text-secondary hover:text-text-primary text-2xl h-auto p-0 min-w-0">
							×
						</Button>
					</div>

					{error && (
						<div className="bg-error-50 dark:bg-error-900/20 text-error-600 dark:text-error-400 p-3 rounded-lg mb-4 text-sm">
							{error}
						</div>
					)}

					<form onSubmit={handleSubmit} className="space-y-4">
						<div>
							<label
								htmlFor="template-name"
								className="block text-sm font-medium text-text-primary mb-2">
								Template Name *
							</label>
							<Input
								id="template-name"
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								required
								placeholder="My Event Template"
							/>
						</div>

						<div>
							<label
								htmlFor="template-description"
								className="block text-sm font-medium text-text-primary mb-2">
								Description
							</label>
							<Textarea
								id="template-description"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								rows={3}
								placeholder="Optional description for this template"
							/>
						</div>

						<div className="flex gap-3 pt-4">
							<Button
								type="submit"
								variant="primary"
								disabled={saving || !name.trim()}
								className="flex-1">
								{saving ? 'Saving...' : 'Save Changes'}
							</Button>
							<Button
								type="button"
								variant="secondary"
								onClick={onClose}
								disabled={saving}>
								Cancel
							</Button>
						</div>
					</form>
				</div>
			</div>
		</Modal>
	)
}

export function TemplatesPage() {
	const { user, logout } = useAuth()
	const navigate = useNavigate()
	const queryClient = useQueryClient()
	const addToast = useUIStore((state) => state.addToast)
	const [previewTemplate, setPreviewTemplate] = useState<EventTemplate | null>(null)
	const [editTemplate, setEditTemplate] = useState<EventTemplate | null>(null)

	// Fetch templates
	const { data: templatesData, isLoading } = useQuery({
		queryKey: queryKeys.templates.list(user?.id),
		queryFn: async () => {
			const body = await api.get<{ templates: EventTemplate[] }>(
				'/event-templates',
				undefined,
				undefined,
				'Failed to fetch templates'
			)
			return body.templates || []
		},
		enabled: Boolean(user),
	})

	const templates = templatesData || []

	// Delete mutation
	const deleteMutation = useMutation({
		mutationFn: async (templateId: string) => {
			await api.delete(
				`/event-templates/${templateId}`,
				undefined,
				'Failed to delete template'
			)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.templates.list(user?.id) })
		},
		onError: (error) => {
			addToast({
				id: generateId(),
				message: error instanceof Error ? error.message : 'Failed to delete template',
				variant: 'error',
			})
		},
	})

	// Update mutation
	const updateMutation = useMutation({
		mutationFn: async ({
			id,
			data,
		}: {
			id: string
			data: { name: string; description: string }
		}) => {
			return api.put(`/event-templates/${id}`, data, undefined, 'Failed to update template')
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.templates.list(user?.id) })
		},
	})

	const handleDelete = useCallback(
		async (templateId: string) => {
			await deleteMutation.mutateAsync(templateId)
		},
		[deleteMutation]
	)

	const handleEdit = useCallback((template: EventTemplate) => {
		setEditTemplate(template)
	}, [])

	const handlePreview = useCallback((template: EventTemplate) => {
		setPreviewTemplate(template)
	}, [])

	const handleUse = useCallback(
		(template: EventTemplate) => {
			// Navigate to feed page with template data in state
			navigate('/feed', { state: { useTemplate: template } })
		},
		[navigate]
	)

	const handleSaveEdit = useCallback(
		async (id: string, data: { name: string; description: string }) => {
			await updateMutation.mutateAsync({ id, data })
		},
		[updateMutation]
	)

	if (!user) {
		return (
			<PageLayout header={<Navbar isConnected={false} user={null} onLogout={logout} />}>
				<Container className="py-8">
					<div className="text-center">
						<h1 className="text-2xl font-bold text-text-primary">Sign In Required</h1>
						<p className="mt-2 text-text-secondary">
							You need to be signed in to manage templates.
						</p>
						<Button
							variant="primary"
							onClick={() => navigate('/login')}
							className="mt-4">
							Sign In
						</Button>
					</div>
				</Container>
			</PageLayout>
		)
	}

	return (
		<>
			<PageLayout header={<Navbar isConnected={false} user={user} onLogout={logout} />}>
				<Container className="py-8">
					<div className="mb-8">
						<h1 className="text-3xl font-bold text-text-primary">Event Templates</h1>
						<p className="mt-2 text-text-secondary">
							Create and manage reusable event templates. Create an event and check
							&quot;Save as template&quot; to add it here.
						</p>
					</div>

					<TemplateList
						templates={templates}
						loading={isLoading}
						onEdit={handleEdit}
						onDelete={handleDelete}
						onPreview={handlePreview}
						onUse={handleUse}
					/>
				</Container>
			</PageLayout>

			{previewTemplate && (
				<TemplatePreviewModal
					template={previewTemplate}
					onClose={() => setPreviewTemplate(null)}
				/>
			)}

			{editTemplate && (
				<TemplateEditModal
					template={editTemplate}
					onClose={() => setEditTemplate(null)}
					onSave={handleSaveEdit}
				/>
			)}
		</>
	)
}
