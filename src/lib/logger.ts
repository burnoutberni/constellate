type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical'

const LOG_LEVELS: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
	critical: 4,
}

const CURRENT_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase() as LogLevel
const MIN_LEVEL = LOG_LEVELS[CURRENT_LEVEL] ?? LOG_LEVELS.info

export function formatMessage(level: LogLevel, message: string): string {
	const prefix = level === 'critical' ? 'CRITICAL' : level.toUpperCase()
	return `[${prefix}] ${message}`
}

export function shouldLog(level: LogLevel): boolean {
	return LOG_LEVELS[level] >= MIN_LEVEL
}

export const logger = {
	debug(message: string, meta?: unknown): void {
		if (shouldLog('debug')) {
			console.debug(formatMessage('debug', message), meta ?? '')
		}
	},

	info(message: string, meta?: unknown): void {
		if (shouldLog('info')) {
			console.info(formatMessage('info', message), meta ?? '')
		}
	},

	warn(message: string, meta?: unknown): void {
		if (shouldLog('warn')) {
			console.warn(formatMessage('warn', message), meta ?? '')
		}
	},

	error(message: string, meta?: unknown): void {
		if (shouldLog('error')) {
			console.error(formatMessage('error', message), meta ?? '')
		}
	},

	critical(message: string, meta?: unknown): void {
		if (shouldLog('critical')) {
			console.error(formatMessage('critical', message), meta ?? '')
		}
	},
}

export type { LogLevel }
