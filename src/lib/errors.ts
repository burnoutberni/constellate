/**
 * Structured Error Handling
 * Prevents information disclosure in production
 */

import { Context } from 'hono'
import { config } from '../config.js'

/**
 * Application Error Class
 * Provides structured error handling with error codes
 */
export class AppError extends Error {
    constructor(
        public code: string,
        message: string,
        public statusCode: number = 500,
        public details?: any
    ) {
        super(message)
        this.name = 'AppError'
    }
}

/**
 * Handles errors and returns appropriate responses
 * Sanitizes error messages in production
 */
export function handleError(error: unknown, c: Context): Response {
    // Handle known application errors
    if (error instanceof AppError) {
        const response: any = {
            error: error.code,
            message: error.message,
        }
        
        // Only include details in development
        if (config.isDevelopment && error.details) {
            response.details = error.details
        }
        
        return c.json(response, error.statusCode)
    }
    
    // Handle Zod validation errors
    if (error && typeof error === 'object' && 'name' in error && error.name === 'ZodError') {
        return c.json({
            error: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            ...(config.isDevelopment && { details: (error as any).errors }),
        }, 400)
    }
    
    // Log full error server-side (for debugging)
    console.error('[Error Handler] Unhandled error:', error)
    
    // Return generic error to client (no sensitive information)
    return c.json({
        error: 'INTERNAL_ERROR',
        message: 'An internal error occurred',
    }, 500)
}

/**
 * Common error factories
 */
export const Errors = {
    notFound: (resource: string = 'Resource') => 
        new AppError('NOT_FOUND', `${resource} not found`, 404),
    
    unauthorized: (message: string = 'Authentication required') =>
        new AppError('UNAUTHORIZED', message, 401),
    
    forbidden: (message: string = 'Access forbidden') =>
        new AppError('FORBIDDEN', message, 403),
    
    badRequest: (message: string = 'Bad request') =>
        new AppError('BAD_REQUEST', message, 400),
    
    conflict: (message: string = 'Resource conflict') =>
        new AppError('CONFLICT', message, 409),
    
    tooManyRequests: (message: string = 'Too many requests') =>
        new AppError('TOO_MANY_REQUESTS', message, 429),
    
    internal: (message: string = 'Internal server error') =>
        new AppError('INTERNAL_ERROR', message, 500),
}

