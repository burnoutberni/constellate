# WP-116: Code Examples and Patterns

## Key UI Components

### 1. TemplateCard Component
Shows a single template with all actions:

```tsx
<TemplateCard
    template={template}
    onEdit={(template) => setEditTemplate(template)}
    onDelete={(templateId) => deleteTemplate(templateId)}
    onPreview={(template) => setPreviewTemplate(template)}
    onUse={(template) => navigate('/feed', { state: { useTemplate: template } })}
/>
```

**Features:**
- Preview data display (title, location, URL, description)
- Metadata badges (last updated, has coordinates)
- Action buttons (Use, Preview, Edit, Delete)
- Delete confirmation dialog
- Design system components (Card, Button, Badge)

### 2. TemplateList Component
Responsive grid layout for templates:

```tsx
<TemplateList
    templates={templates}
    loading={isLoading}
    onEdit={handleEdit}
    onDelete={handleDelete}
    onPreview={handlePreview}
    onUse={handleUse}
/>
```

**States:**
- Loading: Spinner animation
- Empty: Helpful message with icon
- Populated: Grid of template cards (1-3 columns responsive)

### 3. CreateEventModal with Template Save

The "Save as Template" feature in event creation:

```tsx
{user && (
    <div className="border-t border-gray-200 pt-4">
        <label className="flex items-start gap-3 cursor-pointer">
            <input
                type="checkbox"
                checked={saveAsTemplate}
                onChange={(e) => setSaveAsTemplate(e.target.checked)}
            />
            <div>
                <span>Save as template</span>
                <p>Save this event configuration as a reusable template</p>
            </div>
        </label>
        {saveAsTemplate && (
            <div className="mt-4 space-y-3">
                <Input
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Template name"
                />
                <Textarea
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    placeholder="Description"
                />
            </div>
        )}
    </div>
)}
```

### 4. Template Usage Flow

From TemplatesPage to FeedPage with CreateEventModal:

```tsx
// In TemplatesPage:
const handleUse = (template) => {
    navigate('/feed', { state: { useTemplate: template } })
}

// In FeedPage:
useEffect(() => {
    const state = location.state as { useTemplate?: { id: string } }
    if (state?.useTemplate?.id) {
        setTemplateIdToUse(state.useTemplate.id)
        openCreateEventModal()
        navigate('/feed', { replace: true, state: {} })
    }
}, [location.state])

// In CreateEventModal:
<CreateEventModal
    isOpen={createEventModalOpen}
    initialTemplateId={templateIdToUse}
    onClose={closeCreateEventModal}
    onSuccess={handleSuccess}
/>
```

### 5. Template API Integration

Using React Query for data management:

```tsx
// Fetch templates
const { data: templatesData, isLoading } = useQuery({
    queryKey: ['templates', user?.id],
    queryFn: async () => {
        const response = await fetch('/api/event-templates', {
            credentials: 'include',
        })
        const body = await response.json()
        return body.templates || []
    },
    enabled: !!user,
})

// Delete mutation
const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
        const response = await fetch(`/api/event-templates/${templateId}`, {
            method: 'DELETE',
            credentials: 'include',
        })
        if (!response.ok) throw new Error('Failed to delete')
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['templates', user?.id] })
    },
})

// Update mutation
const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
        const response = await fetch(`/api/event-templates/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data),
        })
        return response.json()
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['templates', user?.id] })
    },
})
```

## Design System Usage

### Colors and Tokens
All components use design system tokens:
```tsx
import { primaryColors } from '../design-system/tokens'
```

### Component Imports
```tsx
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { Badge } from './ui/Badge'
import { Input } from './ui/Input'
import { Textarea } from './ui/Textarea'
import { Container } from './layout/Container'
import { PageLayout } from './layout/PageLayout'
import { Grid } from './layout/Grid'
```

### Button Variants
```tsx
<Button variant="primary">Use Template</Button>
<Button variant="ghost">Preview</Button>
<Button variant="danger">Delete</Button>
<Button variant="secondary">Cancel</Button>
```

### Card Variants
```tsx
<Card variant="outlined" padding="md" className="hover:shadow-md">
    {/* content */}
</Card>
```

### Badge Usage
```tsx
<Badge variant="default" size="sm">
    Updated {new Date(template.updatedAt).toLocaleDateString()}
</Badge>
```

### Grid Layout
```tsx
<Grid cols={1} colsMd={2} colsLg={3} gap="md">
    {templates.map((template) => (
        <TemplateCard key={template.id} template={template} {...handlers} />
    ))}
</Grid>
```

## Testing Patterns

### Component Testing
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'

describe('TemplateCard', () => {
    it('should render template name', () => {
        render(
            <BrowserRouter>
                <TemplateCard template={mockTemplate} {...handlers} />
            </BrowserRouter>
        )
        expect(screen.getByText('Template Name')).toBeInTheDocument()
    })
    
    it('should call onUse when button clicked', () => {
        const onUse = vi.fn()
        render(
            <BrowserRouter>
                <TemplateCard template={mockTemplate} onUse={onUse} {...handlers} />
            </BrowserRouter>
        )
        fireEvent.click(screen.getByText('Use Template'))
        expect(onUse).toHaveBeenCalledWith(mockTemplate)
    })
})
```

## Accessibility Features

### Semantic HTML
- Proper heading hierarchy (h1, h2, h3)
- Form labels associated with inputs
- Buttons with descriptive text

### Keyboard Navigation
- All interactive elements are keyboard accessible
- Modal focus trap (built into design system)
- Tab order follows visual order

### ARIA Labels
```tsx
<label htmlFor="template-name" className="block text-sm font-medium">
    Template Name *
</label>
<Input
    id="template-name"
    type="text"
    required
    value={name}
    onChange={(e) => setName(e.target.value)}
/>
```

### Confirmation Dialogs
```tsx
{showDeleteConfirm && (
    <div className="bg-error-50 border border-error-200 rounded-lg p-3">
        <p className="text-sm text-error-700 mb-2">
            Are you sure you want to delete this template? 
            This action cannot be undone.
        </p>
        <div className="flex gap-2">
            <Button variant="danger" onClick={handleDelete}>
                Yes, Delete
            </Button>
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
            </Button>
        </div>
    </div>
)}
```

## Responsive Design

### Grid Breakpoints
- Mobile (< 768px): 1 column
- Tablet (768px - 1024px): 2 columns
- Desktop (>= 1024px): 3 columns

```tsx
<Grid cols={1} colsMd={2} colsLg={3} gap="md">
```

### Container Constraints
```tsx
<Container className="py-8">
    {/* Max-width constrained content */}
</Container>
```

### Mobile-Friendly Modals
```tsx
<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Scrollable modal content */}
    </div>
</div>
```
