import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { TemplateList } from '../../components/TemplateList'
import type { EventTemplate } from '../../components/TemplateCard'

const mockTemplates: EventTemplate[] = [
    {
        id: 'template-1',
        name: 'Template 1',
        description: 'Description 1',
        data: { title: 'Event 1' },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
    },
    {
        id: 'template-2',
        name: 'Template 2',
        description: 'Description 2',
        data: { title: 'Event 2' },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
    },
]

const renderTemplateList = (templates: EventTemplate[] = mockTemplates, loading = false) => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    const onPreview = vi.fn()
    const onUse = vi.fn()

    return render(
        <BrowserRouter>
            <TemplateList
                templates={templates}
                loading={loading}
                onEdit={onEdit}
                onDelete={onDelete}
                onPreview={onPreview}
                onUse={onUse}
            />
        </BrowserRouter>
    )
}

describe('TemplateList', () => {
    it('should render loading spinner when loading', () => {
        renderTemplateList([], true)
        const spinner = document.querySelector('.animate-spin')
        expect(spinner).toBeInTheDocument()
    })

    it('should render empty state when no templates', () => {
        renderTemplateList([])
        expect(screen.getByText('No templates yet')).toBeInTheDocument()
        expect(screen.getByText(/Get started by creating an event/)).toBeInTheDocument()
    })

    it('should render all templates', () => {
        renderTemplateList()
        expect(screen.getByText('Template 1')).toBeInTheDocument()
        expect(screen.getByText('Template 2')).toBeInTheDocument()
    })

    it('should render template descriptions', () => {
        renderTemplateList()
        expect(screen.getByText('Description 1')).toBeInTheDocument()
        expect(screen.getByText('Description 2')).toBeInTheDocument()
    })

    it('should render correct number of template cards', () => {
        renderTemplateList()
        const useButtons = screen.getAllByText('Use Template')
        expect(useButtons).toHaveLength(2)
    })
})
