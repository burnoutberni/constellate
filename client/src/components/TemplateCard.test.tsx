import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { TemplateCard, type EventTemplate } from './TemplateCard'

const mockTemplate: EventTemplate = {
    id: 'test-template-1',
    name: 'Test Template',
    description: 'A test template description',
    data: {
        title: 'Test Event',
        summary: 'Test event summary',
        location: 'Test Location',
        url: 'https://example.com',
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
}

const renderTemplateCard = (template: EventTemplate = mockTemplate) => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    const onPreview = vi.fn()
    const onUse = vi.fn()

    const result = render(
        <BrowserRouter>
            <TemplateCard
                template={template}
                onEdit={onEdit}
                onDelete={onDelete}
                onPreview={onPreview}
                onUse={onUse}
            />
        </BrowserRouter>
    )

    return { ...result, onEdit, onDelete, onPreview, onUse }
}

describe('TemplateCard', () => {
    it('should render template name and description', () => {
        renderTemplateCard()
        expect(screen.getByText('Test Template')).toBeInTheDocument()
        expect(screen.getByText('A test template description')).toBeInTheDocument()
    })

    it('should render template data fields', () => {
        renderTemplateCard()
        expect(screen.getByText('Test Event')).toBeInTheDocument()
        expect(screen.getByText('Test Location')).toBeInTheDocument()
        expect(screen.getByText('https://example.com')).toBeInTheDocument()
    })

    it('should call onUse when Use Template button is clicked', () => {
        const { onUse } = renderTemplateCard()
        const useButton = screen.getByText('Use Template')
        fireEvent.click(useButton)
        expect(onUse).toHaveBeenCalledWith(mockTemplate)
    })

    it('should call onPreview when Preview button is clicked', () => {
        const { onPreview } = renderTemplateCard()
        const previewButton = screen.getByText('Preview')
        fireEvent.click(previewButton)
        expect(onPreview).toHaveBeenCalledWith(mockTemplate)
    })

    it('should call onEdit when Edit button is clicked', () => {
        const { onEdit } = renderTemplateCard()
        const editButton = screen.getByText('Edit')
        fireEvent.click(editButton)
        expect(onEdit).toHaveBeenCalledWith(mockTemplate)
    })

    it('should show delete confirmation when Delete button is clicked', () => {
        renderTemplateCard()
        const deleteButton = screen.getByText('Delete')
        fireEvent.click(deleteButton)
        expect(screen.getByText(/Are you sure you want to delete this template/)).toBeInTheDocument()
    })

    it('should call onDelete when confirmation is accepted', () => {
        const { onDelete } = renderTemplateCard()
        const deleteButton = screen.getByText('Delete')
        fireEvent.click(deleteButton)
        const confirmButton = screen.getByText('Yes, Delete')
        fireEvent.click(confirmButton)
        expect(onDelete).toHaveBeenCalledWith('test-template-1')
    })

    it('should hide delete confirmation when Cancel is clicked', () => {
        renderTemplateCard()
        const deleteButton = screen.getByText('Delete')
        fireEvent.click(deleteButton)
        const cancelButton = screen.getByText('Cancel')
        fireEvent.click(cancelButton)
        expect(screen.queryByText(/Are you sure you want to delete this template/)).not.toBeInTheDocument()
    })

    it('should render coordinates badge when coordinates are present', () => {
        const templateWithCoordinates: EventTemplate = {
            ...mockTemplate,
            data: {
                ...mockTemplate.data,
                locationLatitude: 40.7128,
                locationLongitude: -74.0060,
            },
        }
        renderTemplateCard(templateWithCoordinates)
        expect(screen.getByText('Has Coordinates')).toBeInTheDocument()
    })

    it('should not render coordinates badge when coordinates are missing', () => {
        renderTemplateCard()
        expect(screen.queryByText('Has Coordinates')).not.toBeInTheDocument()
    })
})
