import { describe, it, expect, vi } from 'vitest'
import { VisibilitySelector } from '../../components/VisibilitySelector'

describe('VisibilitySelector', () => {
	it('renders with PUBLIC visibility by default', () => {
		const onChange = vi.fn()

		const component = VisibilitySelector({ value: 'PUBLIC', onChange })
		expect(component).toBeDefined()
	})

	it('renders with PRIVATE visibility', () => {
		const onChange = vi.fn()

		const component = VisibilitySelector({ value: 'PRIVATE', onChange })
		expect(component).toBeDefined()
	})

	it('renders with FOLLOWERS visibility', () => {
		const onChange = vi.fn()

		const component = VisibilitySelector({ value: 'FOLLOWERS', onChange })
		expect(component).toBeDefined()
	})

	it('renders with UNLISTED visibility', () => {
		const onChange = vi.fn()

		const component = VisibilitySelector({ value: 'UNLISTED', onChange })
		expect(component).toBeDefined()
	})
})
