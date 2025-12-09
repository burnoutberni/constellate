/**
 * Utility functions for handling API errors consistently
 */

/**
 * Builds a user-friendly error message from an API response
 * @param baseMessage - The base error message (e.g., "Failed to search events")
 * @param response - The fetch Response object
 * @returns A formatted error message string
 */
export async function buildErrorMessage(baseMessage: string, response: Response): Promise<string> {
    const statusCode = response.status
    let errorMessage = baseMessage
    
    try {
        const errorBody = await response.json() as { error?: string }
        if (errorBody.error) {
            errorMessage = `${errorMessage}: ${errorBody.error}`
        }
    } catch {
        // If response body isn't JSON, use status-based message
        if (statusCode >= 400 && statusCode < 500) {
            errorMessage = `${errorMessage} (${statusCode}): Invalid request parameters.`
        } else if (statusCode >= 500) {
            errorMessage = `${errorMessage} (${statusCode}): Server error. Please try again later.`
        }
    }
    
    return errorMessage
}

