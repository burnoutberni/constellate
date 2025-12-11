import { describe, it, expect, vi } from 'vitest'
import { TemplateSelector } from '../../components/TemplateSelector'

describe('TemplateSelector', () => {
  it('renders with no templates', () => {
    const onSelect = vi.fn()
    const onRefresh = vi.fn()
    
    const component = TemplateSelector({
      templates: [],
      selectedId: '',
      onSelect,
      onRefresh,
    })
    expect(component).toBeDefined()
  })

  it('renders with templates', () => {
    const onSelect = vi.fn()
    const onRefresh = vi.fn()
    
    const templates = [
      {
        id: '1',
        name: 'Template 1',
        data: {},
      },
      {
        id: '2',
        name: 'Template 2',
        data: {},
      },
    ]
    
    const component = TemplateSelector({
      templates,
      selectedId: '',
      onSelect,
      onRefresh,
    })
    expect(component).toBeDefined()
  })

  it('renders with selected template', () => {
    const onSelect = vi.fn()
    const onRefresh = vi.fn()
    
    const templates = [
      {
        id: '1',
        name: 'Template 1',
        data: {},
      },
    ]
    
    const component = TemplateSelector({
      templates,
      selectedId: '1',
      onSelect,
      onRefresh,
    })
    expect(component).toBeDefined()
  })

  it('renders with loading state', () => {
    const onSelect = vi.fn()
    const onRefresh = vi.fn()
    
    const component = TemplateSelector({
      templates: [],
      selectedId: '',
      onSelect,
      onRefresh,
      loading: true,
    })
    expect(component).toBeDefined()
  })

  it('renders with error', () => {
    const onSelect = vi.fn()
    const onRefresh = vi.fn()
    
    const component = TemplateSelector({
      templates: [],
      selectedId: '',
      onSelect,
      onRefresh,
      error: 'Failed to load templates',
    })
    expect(component).toBeDefined()
  })
})
