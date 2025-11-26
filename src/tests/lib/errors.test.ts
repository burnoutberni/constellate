import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Context } from 'hono'
import { AppError, handleError, Errors } from '../../lib/errors.js'
import { ZodError } from 'zod'
import { config } from '../../config.js'

// Mock config
vi.mock('../../config.js', () => ({
    config: {
        isDevelopment: true,
    },
}))

describe('Error Handling', () => {
    let mockContext: Context
    let mockJson: ReturnType<typeof vi.fn>

    beforeEach(() => {
        mockJson = vi.fn().mockReturnValue(new Response())
        mockContext = {
            json: mockJson,
        } as unknown as Context
    })

    describe('AppError', () => {
        it('should create error with code and message', () => {
            const error = new AppError('TEST_ERROR', 'Test error message')
            
            expect(error).toBeInstanceOf(Error)
            expect(error).toBeInstanceOf(AppError)
            expect(error.code).toBe('TEST_ERROR')
            expect(error.message).toBe('Test error message')
            expect(error.statusCode).toBe(500)
            expect(error.name).toBe('AppError')
        })

        it('should create error with custom status code', () => {
            const error = new AppError('NOT_FOUND', 'Resource not found', 404)
            
            expect(error.statusCode).toBe(404)
        })

        it('should create error with details', () => {
            const details = { field: 'value' }
            const error = new AppError('TEST_ERROR', 'Test error', 400, details)
            
            expect(error.details).toEqual(details)
        })
    })

    describe('handleError', () => {
        it('should handle AppError', () => {
            const error = new AppError('TEST_ERROR', 'Test error', 400)
            const response = handleError(error, mockContext)
            
            expect(mockJson).toHaveBeenCalledWith(
                {
                    error: 'TEST_ERROR',
                    message: 'Test error',
                    details: undefined,
                },
                400
            )
        })

        it('should include details in development mode', () => {
            const details = { field: 'value' }
            const error = new AppError('TEST_ERROR', 'Test error', 400, details)
            
            handleError(error, mockContext)
            
            expect(mockJson).toHaveBeenCalledWith(
                expect.objectContaining({
                    details: details,
                }),
                400
            )
        })

        it('should not include details when undefined', () => {
            const error = new AppError('TEST_ERROR', 'Test error', 400)
            
            handleError(error, mockContext)
            
            const call = mockJson.mock.calls[0][0]
            expect(call.details).toBeUndefined()
        })

        it('should handle ZodError', () => {
            const zodError = new ZodError([
                {
                    code: 'invalid_type',
                    expected: 'string',
                    received: 'number',
                    path: ['field'],
                    message: 'Expected string, received number',
                },
            ])
            
            handleError(zodError, mockContext)
            
            expect(mockJson).toHaveBeenCalledWith(
                {
                    error: 'VALIDATION_ERROR',
                    message: 'Invalid input data',
                    details: zodError.issues,
                },
                400
            )
        })

        it('should handle ZodError without details in production', () => {
            // Mock production mode
            vi.mocked(config).isDevelopment = false
            
            const zodError = new ZodError([
                {
                    code: 'invalid_type',
                    expected: 'string',
                    received: 'number',
                    path: ['field'],
                    message: 'Expected string, received number',
                },
            ])
            
            handleError(zodError, mockContext)
            
            expect(mockJson).toHaveBeenCalledWith(
                {
                    error: 'VALIDATION_ERROR',
                    message: 'Invalid input data',
                },
                400
            )
            
            // Reset to development mode
            vi.mocked(config).isDevelopment = true
        })

        it('should handle unknown errors', () => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
            const unknownError = new Error('Unknown error')
            
            handleError(unknownError, mockContext)
            
            expect(consoleErrorSpy).toHaveBeenCalledWith('[Error Handler] Unhandled error:', unknownError)
            expect(mockJson).toHaveBeenCalledWith(
                {
                    error: 'INTERNAL_ERROR',
                    message: 'An internal error occurred',
                },
                500
            )
            
            consoleErrorSpy.mockRestore()
        })

        it('should handle non-Error objects', () => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
            const unknownError = 'String error'
            
            handleError(unknownError, mockContext)
            
            expect(consoleErrorSpy).toHaveBeenCalledWith('[Error Handler] Unhandled error:', unknownError)
            expect(mockJson).toHaveBeenCalledWith(
                {
                    error: 'INTERNAL_ERROR',
                    message: 'An internal error occurred',
                },
                500
            )
            
            consoleErrorSpy.mockRestore()
        })
    })

    describe('Errors factory', () => {
        describe('notFound', () => {
            it('should create 404 error with default message', () => {
                const error = Errors.notFound()
                
                expect(error).toBeInstanceOf(AppError)
                expect(error.code).toBe('NOT_FOUND')
                expect(error.message).toBe('Resource not found')
                expect(error.statusCode).toBe(404)
            })

            it('should create 404 error with custom resource name', () => {
                const error = Errors.notFound('User')
                
                expect(error.message).toBe('User not found')
            })
        })

        describe('unauthorized', () => {
            it('should create 401 error with default message', () => {
                const error = Errors.unauthorized()
                
                expect(error).toBeInstanceOf(AppError)
                expect(error.code).toBe('UNAUTHORIZED')
                expect(error.message).toBe('Authentication required')
                expect(error.statusCode).toBe(401)
            })

            it('should create 401 error with custom message', () => {
                const error = Errors.unauthorized('Invalid token')
                
                expect(error.message).toBe('Invalid token')
            })
        })

        describe('forbidden', () => {
            it('should create 403 error with default message', () => {
                const error = Errors.forbidden()
                
                expect(error).toBeInstanceOf(AppError)
                expect(error.code).toBe('FORBIDDEN')
                expect(error.message).toBe('Access forbidden')
                expect(error.statusCode).toBe(403)
            })

            it('should create 403 error with custom message', () => {
                const error = Errors.forbidden('Insufficient permissions')
                
                expect(error.message).toBe('Insufficient permissions')
            })
        })

        describe('badRequest', () => {
            it('should create 400 error with default message', () => {
                const error = Errors.badRequest()
                
                expect(error).toBeInstanceOf(AppError)
                expect(error.code).toBe('BAD_REQUEST')
                expect(error.message).toBe('Bad request')
                expect(error.statusCode).toBe(400)
            })

            it('should create 400 error with custom message', () => {
                const error = Errors.badRequest('Invalid input')
                
                expect(error.message).toBe('Invalid input')
            })
        })

        describe('conflict', () => {
            it('should create 409 error with default message', () => {
                const error = Errors.conflict()
                
                expect(error).toBeInstanceOf(AppError)
                expect(error.code).toBe('CONFLICT')
                expect(error.message).toBe('Resource conflict')
                expect(error.statusCode).toBe(409)
            })

            it('should create 409 error with custom message', () => {
                const error = Errors.conflict('Resource already exists')
                
                expect(error.message).toBe('Resource already exists')
            })
        })

        describe('tooManyRequests', () => {
            it('should create 429 error with default message', () => {
                const error = Errors.tooManyRequests()
                
                expect(error).toBeInstanceOf(AppError)
                expect(error.code).toBe('TOO_MANY_REQUESTS')
                expect(error.message).toBe('Too many requests')
                expect(error.statusCode).toBe(429)
            })

            it('should create 429 error with custom message', () => {
                const error = Errors.tooManyRequests('Rate limit exceeded')
                
                expect(error.message).toBe('Rate limit exceeded')
            })
        })

        describe('internal', () => {
            it('should create 500 error with default message', () => {
                const error = Errors.internal()
                
                expect(error).toBeInstanceOf(AppError)
                expect(error.code).toBe('INTERNAL_ERROR')
                expect(error.message).toBe('Internal server error')
                expect(error.statusCode).toBe(500)
            })

            it('should create 500 error with custom message', () => {
                const error = Errors.internal('Database connection failed')
                
                expect(error.message).toBe('Database connection failed')
            })
        })
    })
})

