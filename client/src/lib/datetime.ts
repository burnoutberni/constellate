export function formatRelativeTime(value: string | number | Date) {
	const date = value instanceof Date ? value : new Date(value)
	if (Number.isNaN(date.getTime())) {
		return ''
	}

	const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000)

	if (diffSeconds < 0) {
		return 'just now'
	}

	if (diffSeconds < 5) {
		return 'just now'
	}
	if (diffSeconds < 60) {
		return `${diffSeconds}s ago`
	}

	const diffMinutes = Math.floor(diffSeconds / 60)
	if (diffMinutes < 60) {
		return `${diffMinutes}m ago`
	}

	const diffHours = Math.floor(diffMinutes / 60)
	if (diffHours < 24) {
		return `${diffHours}h ago`
	}

	const diffDays = Math.floor(diffHours / 24)
	if (diffDays < 7) {
		return `${diffDays}d ago`
	}

	return date.toLocaleDateString(undefined, {
		month: 'short',
		day: 'numeric',
	})
}
