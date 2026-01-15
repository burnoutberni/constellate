
import { Link } from 'react-router-dom'

import { Avatar, Tooltip } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { getInitials } from '@/lib/utils'
import type { Event } from '@/types'

export function AttendeeFacepile({
    attendance = [],
    counts: _counts,
    alwaysShowCounts: _alwaysShowCounts = false,
}: {
    attendance?: Event['attendance']
    counts?: { attendance?: number }
    alwaysShowCounts?: boolean
}) {
    const { user: currentUser } = useAuth()

    // Filter logic to ensure user and id exist at runtime
    type AttendanceItem = NonNullable<Event['attendance']>[number]
    const hasUser = (a: AttendanceItem) => Boolean(a.user?.id)

    // Helper to get user data - use current user data if it's the viewer's attendance
    const getUserData = (attendanceItem: AttendanceItem) => {
        if (currentUser && attendanceItem.user?.id === currentUser.id) {
            // Use fresh data from current user context
            return {
                ...attendanceItem.user,
                name: currentUser.name,
                username: currentUser.username,
                profileImage: currentUser.image,
            }
        }
        return attendanceItem.user
    }

    const going = attendance.filter((a) => a.status === 'attending' && hasUser(a))
    const maybe = attendance.filter((a) => a.status === 'maybe' && hasUser(a))

    // Use actual filtered counts - don't use counts.attendance as it includes both going AND maybe
    const goingCount = going.length
    const maybeCount = maybe.length

    // Limit faces
    const MAX_FACES = 5
    const displayedGoing = going.slice(0, MAX_FACES)
    const remainingSlots = Math.max(0, MAX_FACES - displayedGoing.length)
    const displayedMaybe = maybe.slice(0, remainingSlots)

    if (goingCount === 0 && maybeCount === 0) {
        return (
            <span className="text-xs text-text-secondary italic">
                Be the first to confirm your attendance
            </span>
        )
    }

    // Prepare tooltip content
    const totalCount = _counts?.attendance || goingCount + maybeCount
    const displayedCount = going.length

    // Calculate hidden count properly:
    // If totalCount > displayedCount, there are others (private or just not fetched in this list)
    // Plus if we truncated the list in the tooltip

    const getTooltipContent = () => {
        const items = going.map(a => {
            const u = getUserData(a)
            return {
                id: u?.id || u?.username || 'unknown',
                name: u?.name || u?.username || 'Unknown',
            }
        })

        // Basic sort: Current user first, then alphabetical
        items.sort((a, b) => {
            if (a.id === currentUser?.id) { return -1 }
            if (b.id === currentUser?.id) { return 1 }
            return a.name.localeCompare(b.name)
        })

        // Generate unique keys by tracking seen ids with a counter
        const seenIds = new Map<string, number>()
        const getUniqueKey = (item: { id: string; name: string }) => {
            const count = (seenIds.get(item.id) || 0) + 1
            seenIds.set(item.id, count)
            return `${item.id}-${count}`
        }

        // We can list up to 10 names
        const visibleItems = items.slice(0, 10)

        // Remaining count is (Total Attending) - (Names Shown in Tooltip)
        const knownHiddenCount = Math.max(0, totalCount - displayedCount)
        const tooltipHiddenCount = Math.max(0, items.length - visibleItems.length)
        const totalHiddenCount = knownHiddenCount + tooltipHiddenCount

        return (
            <div className="text-xs text-left">
                {visibleItems.map((item) => (
                    <div key={getUniqueKey(item)}>{item.name}</div>
                ))}
                {totalHiddenCount > 0 && (
                    <div className="text-gray-400 mt-1 italic">and {totalHiddenCount} others</div>
                )}
            </div>
        )
    }

    return (
        <div className="flex items-center gap-3 h-8 cursor-default">
            {/* Avatars Container - Spreads on hover */}
            <div className="group flex items-center -space-x-2 transition-all duration-500 ease-out hover:space-x-1 hover:ml-1">
                {/* Going Group */}
                {displayedGoing.map((a, i) => {
                    const userData = getUserData(a)
                    if (!userData) { return null }

                    const profileLink = userData.username ? `/@${userData.username}` : '#'

                    return (
                        <div
                            key={a.user?.id || `going-${i}`}
                            className="relative transition-transform duration-300 group-hover:scale-110 z-20"
                            style={{ zIndex: 30 - i }} // Stack: First on top
                        >
                            <Tooltip content={userData.name || userData.username}>
                                <Link to={profileLink} onClick={(e) => e.stopPropagation()}>
                                    <Avatar
                                        src={userData.profileImage || undefined}
                                        alt={userData.name || userData.username || 'User'}
                                        fallback={getInitials(userData.name, userData.username || '?')}
                                        size="sm"
                                        className="border-2 border-background-primary transition-all hover:border-primary-500"
                                    />
                                </Link>
                            </Tooltip>
                        </div>
                    )
                })}

                {/* Maybe Group */}
                {displayedMaybe.map((a, i) => {
                    const userData = getUserData(a)
                    if (!userData) { return null }

                    const profileLink = userData.username ? `/@${userData.username}` : '#'

                    return (
                        <div
                            key={a.user?.id || `maybe-${i}`}
                            className="relative transition-all duration-300 group-hover:scale-105 z-10"
                            style={{ zIndex: 10 - i }}
                        >
                            <Tooltip content={userData.name || userData.username}>
                                <Link to={profileLink} onClick={(e) => e.stopPropagation()}>
                                    <Avatar
                                        src={userData.profileImage || undefined}
                                        fallback={getInitials(userData.name, userData.username)}
                                        size="xs"
                                        bordered
                                        className="grayscale opacity-60 ring-background-primary dark:ring-neutral-900 ring-2 group-hover:grayscale-0 group-hover:opacity-100 transition-all hover:ring-primary-500"
                                    />
                                </Link>
                            </Tooltip>
                        </div>
                    )
                })}
            </div>

            {/* Text Summary */}
            <Tooltip content={getTooltipContent()} side="top">
                <div
                    className={'flex flex-col justify-center text-xs whitespace-nowrap transition-all duration-300 opacity-100 translate-x-0'}
                >
                    {goingCount > 0 && (
                        <span className="font-medium text-text-primary hover:underline decoration-dotted cursor-help">
                            {goingCount} going
                        </span>
                    )}
                    {maybeCount > 0 && (
                        <span className="text-text-secondary ml-1">
                            {maybeCount} maybe
                        </span>
                    )}
                </div>
            </Tooltip>
        </div>
    )
}

