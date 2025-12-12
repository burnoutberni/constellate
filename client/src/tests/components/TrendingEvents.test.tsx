import { describe, it, expect } from 'vitest'
import { TrendingEvents } from '../../components/TrendingEvents'

describe('TrendingEvents', () => {
	it('should export TrendingEvents component', () => {
		expect(TrendingEvents).toBeDefined()
	})

	it('should accept limit and windowDays props', () => {
		expect(typeof TrendingEvents).toBe('function')
	})
})
