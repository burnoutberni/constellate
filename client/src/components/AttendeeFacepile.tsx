
import { Avatar } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { getInitials } from '@/lib/utils'
import type { Event } from '@/types'

export function AttendeeFacepile({
    attendance = [],
    counts: _counts,
    alwaysShowCounts = false
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

    const going = attendance.filter(a => a.status === 'attending' && hasUser(a))
    const maybe = attendance.filter(a => a.status === 'maybe' && hasUser(a))

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

    return (
        <div className="group flex items-center gap-3 h-8 cursor-default">
            {/* Avatars Container */}
            <div className="flex items-center -space-x-2 transition-all duration-500 ease-out group-hover:space-x-1 group-hover:ml-1">

                {/* Going Group */}
                {displayedGoing.map((a, i) => {
                    const userData = getUserData(a)
                    return (
                        <div
                            key={a.user?.id || `going-${i}`}
                            className="relative transition-transform duration-300 group-hover:scale-110 z-20"
                            style={{ zIndex: 30 - i }} // Stack: First on top
                        >
                            <Avatar
                                src={userData?.profileImage || undefined}
                                alt={userData?.name || userData?.username || 'User'}
                                fallback={getInitials(userData?.name, userData?.username || '?')}
                                size="sm"
                                className="border-2 border-background-primary"
                            />
                        </div>
                    )
                })}

                {/* Maybe Group */}
                {displayedMaybe.map((a, i) => {
                    const userData = getUserData(a)
                    return (
                        <div
                            key={a.user?.id || `maybe-${i}`}
                            className="relative transition-all duration-300 group-hover:scale-105 z-10"
                            style={{ zIndex: 10 - i }}
                        >
                            <Avatar
                                src={userData?.profileImage || undefined}
                                fallback={getInitials(userData?.name, userData?.username)}
                                size="xs"
                                bordered
                                className="grayscale opacity-60 ring-background-primary dark:ring-neutral-900 ring-2 group-hover:grayscale-0 group-hover:opacity-100"
                            />
                        </div>
                    )
                })}


            </div>

            {/* Text Summary - Always visible if alwaysShowCounts, otherwise fades in on hover */}
            <div className={`flex flex-col justify-center text-xs whitespace-nowrap transition-all duration-300 ${alwaysShowCounts
                ? 'opacity-100 translate-x-0'
                : 'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 delay-75 pointer-events-none'
                }`}>
                {goingCount > 0 && (
                    <span className="font-medium text-text-primary">
                        {goingCount} going
                    </span>
                )}
                {maybeCount > 0 && (
                    <span className="text-text-secondary">
                        {maybeCount} maybe
                    </span>
                )}
            </div>
        </div>
    )
}
