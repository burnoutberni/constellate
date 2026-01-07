
export const formatDateTime = (dateString: string | Date) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = Math.abs(now.getTime() - date.getTime())
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days < 7) {
        // Relative logic if we want, or simple short format
        return date.toLocaleDateString(undefined, {
            weekday: 'short',
            hour: 'numeric',
            minute: '2-digit'
        })
    }

    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        hour: 'numeric',
        minute: '2-digit',
    })
}
