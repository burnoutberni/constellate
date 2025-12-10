import { describe, it, expect } from 'vitest'
import { queryKeys } from './keys'

describe('Reminders Query Keys', () => {
    it('should generate correct list query key', () => {
        const key = queryKeys.reminders.list()
        expect(key).toEqual(['reminders', 'list'])
    })
})
