/**
 * Logger utility for consistent logging across the application
 * 
 * This module provides a centralized logging system that:
 * - Supports different log levels (debug, info, warn, error)
 * - Respects environment settings (development vs production)
 * - Supports context/prefixes for better debugging
 * - Can be extended for production logging services
 * 
 * @example
 * ```typescript
 * import { logger } from '@/lib/logger'
 * 
 * // Basic usage
 * logger.info('User logged in')
 * logger.warn('API rate limit approaching')
 * logger.error('Failed to fetch data', error)
 * 
 * // With context
 * const log = logger.withContext('[LoginPage]')
 * log.error('Authentication failed', error)
 * 
 * // Debug logs (only in development)
 * logger.debug('Component rendered', { props })
 * ```
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LoggerConfig {
    /**
     * Minimum log level to output
     * Logs below this level will be ignored
     */
    minLevel: LogLevel
    /**
     * Whether to enable logging in production
     * If false, only logs in development
     */
    enableInProduction: boolean
    /**
     * Custom log handler (for sending to external services)
     */
    onLog?: (level: LogLevel, message: string, ...args: unknown[]) => void
}

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
}

const DEFAULT_CONFIG: LoggerConfig = {
    minLevel: 'debug',
    enableInProduction: false,
}

class Logger {
    public config: LoggerConfig
    private context?: string

    constructor(config: Partial<LoggerConfig> = {}, context?: string) {
        this.config = { ...DEFAULT_CONFIG, ...config }
        this.context = context
    }

    /**
     * Creates a new logger instance with a context prefix
     * 
     * @param context - Context string to prefix all log messages
     * @returns New logger instance with the context
     */
    withContext(context: string): Logger {
        return new Logger(this.config, context)
    }

    /**
     * Checks if logging should occur for the given level
     */
    private shouldLog(level: LogLevel): boolean {
        const isDevelopment = import.meta.env.DEV || process.env.NODE_ENV === 'development'
        
        // Always log in development
        if (isDevelopment) {
            return LOG_LEVELS[level] >= LOG_LEVELS[this.config.minLevel]
        }

        // In production, only log if enabled and level is warn or error
        if (this.config.enableInProduction) {
            return LOG_LEVELS[level] >= LOG_LEVELS[this.config.minLevel]
        }

        // In production with default config, only log errors
        return level === 'error'
    }

    /**
     * Formats the log message with context
     */
    private formatMessage(message: string): string {
        return this.context ? `${this.context} ${message}` : message
    }

    /**
     * Internal log method
     */
    private log(level: LogLevel, message: string, ...args: unknown[]): void {
        if (!this.shouldLog(level)) {
            return
        }

        const formattedMessage = this.formatMessage(message)
        // Only use allowed console methods: warn and error
        // For debug/info, use console.warn as fallback
        if (level === 'error') {
            console.error(formattedMessage, ...args)
        } else if (level === 'warn') {
            console.warn(formattedMessage, ...args)
        } else {
            // For debug/info, use console.warn (linter only allows warn/error)
            console.warn(formattedMessage, ...args)
        }

        // Call custom log handler if provided
        if (this.config.onLog) {
            this.config.onLog(level, formattedMessage, ...args)
        }
    }

    /**
     * Logs a debug message (only in development)
     */
    debug(message: string, ...args: unknown[]): void {
        this.log('debug', message, ...args)
    }

    /**
     * Logs an info message
     */
    info(message: string, ...args: unknown[]): void {
        this.log('info', message, ...args)
    }

    /**
     * Logs a warning message
     */
    warn(message: string, ...args: unknown[]): void {
        this.log('warn', message, ...args)
    }

    /**
     * Logs an error message
     */
    error(message: string, ...args: unknown[]): void {
        this.log('error', message, ...args)
    }
}

/**
 * Default logger instance
 * Use this for most logging needs
 */
export const logger = new Logger()

/**
 * Configure the default logger
 * 
 * @example
 * ```typescript
 * import { configureLogger } from '@/lib/logger'
 * 
 * configureLogger({
 *   minLevel: 'warn',
 *   enableInProduction: true,
 *   onLog: (level, message, ...args) => {
 *     // Send to external logging service
 *   }
 * })
 * ```
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
    Object.assign((logger as Logger).config, config)
}

/**
 * Create a logger with a specific context
 * 
 * @example
 * ```typescript
 * import { createLogger } from '@/lib/logger'
 * 
 * const log = createLogger('[MyComponent]')
 * log.error('Something went wrong', error)
 * ```
 */
export function createLogger(context: string): Logger {
    return logger.withContext(context)
}
