import { describe, it, expect } from 'vitest'
import { ActivityFilters } from '../../components/ActivityFilters'

describe('ActivityFilters', () => {
	it('should export ActivityFilters component', () => {
		expect(ActivityFilters).toBeDefined()
		expect(typeof ActivityFilters).toBe('function')
	})
})
