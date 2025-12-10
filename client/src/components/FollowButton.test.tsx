import { describe, it, expect } from 'vitest'
import { FollowButton } from './FollowButton'

describe('FollowButton', () => {
    it('should export FollowButton component', () => {
        expect(FollowButton).toBeDefined()
        expect(typeof FollowButton).toBe('function')
    })
})
