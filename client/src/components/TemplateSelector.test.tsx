import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { TemplateSelector } from './TemplateSelector'

describe('TemplateSelector', () => {
	const mockTemplates = [{ id: '1', name: 'Test Template', data: {} }]

	it('renders with an accessible name for the select element', () => {
		render(
			<TemplateSelector
				templates={mockTemplates}
				selectedId=""
				onSelect={() => {}}
				onRefresh={() => {}}
			/>
		)

		// This expects the select element to be accessible via the label "Start from template"
		// The current implementation fails this because the text is not associated with the select.
		const select = screen.getByLabelText(/start from template/i)
		expect(select).toBeInTheDocument()
		expect(select.tagName).toBe('SELECT')
	})
})
