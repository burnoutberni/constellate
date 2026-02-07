import { describe, it, expect, vi } from 'vitest'
import { searchInstances } from '../../lib/instanceHelpers'
import { prisma } from '../../lib/prisma'

vi.mock('../../lib/prisma', () => ({
    prisma: {
        instance: {
            findMany: vi.fn(),
        },
    },
}))

describe('instanceHelpers', () => {
    describe('searchInstances', () => {
        it('should search for instances', async () => {
            const mockInstances = [{ domain: 'test.com' }]
            ;(prisma.instance.findMany as any).mockResolvedValue(mockInstances)

            const result = await searchInstances('test')
            expect(result).toEqual(mockInstances)
            expect(prisma.instance.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: expect.objectContaining({
                    AND: expect.arrayContaining([
                        { isBlocked: false },
                        expect.any(Object)
                    ])
                })
            }))
        })
    })
})
