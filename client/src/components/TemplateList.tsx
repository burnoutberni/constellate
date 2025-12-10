import { Grid } from './layout/Grid'
import { TemplateCard, type EventTemplate } from './TemplateCard'

interface TemplateListProps {
    templates: EventTemplate[]
    loading?: boolean
    onEdit: (template: EventTemplate) => void
    onDelete: (templateId: string) => void
    onPreview: (template: EventTemplate) => void
    onUse: (template: EventTemplate) => void
}

export function TemplateList({ 
    templates, 
    loading = false, 
    onEdit, 
    onDelete, 
    onPreview, 
    onUse 
}: TemplateListProps) {
    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
            </div>
        )
    }

    if (templates.length === 0) {
        return (
            <div className="text-center py-12">
                <svg 
                    className="mx-auto h-12 w-12 text-gray-400" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor" 
                    aria-hidden="true"
                >
                    <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
                    />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No templates yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                    Get started by creating an event and saving it as a template.
                </p>
            </div>
        )
    }

    return (
        <Grid cols={1} colsMd={2} colsLg={3} gap="md">
            {templates.map((template) => (
                <TemplateCard
                    key={template.id}
                    template={template}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onPreview={onPreview}
                    onUse={onUse}
                />
            ))}
        </Grid>
    )
}
