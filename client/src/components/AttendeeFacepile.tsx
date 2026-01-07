
import { Avatar } from '@/components/ui'
import type { Event } from '@/types'

export function AttendeeFacepile({ attendance = [], counts }: { attendance?: Event['attendance'], counts?: { attendance?: number } }) {
    // Filter logic to ensure user and id exist at runtime
    type AttendanceItem = NonNullable<Event['attendance']>[number]
    const hasUser = (a: AttendanceItem) => Boolean(a.user?.id)

    const going = attendance.filter(a => a.status === 'attending' && hasUser(a))
    const maybe = attendance.filter(a => a.status === 'maybe' && hasUser(a))



    const goingCount = counts?.attendance ?? going.length
    const maybeCount = maybe.length // Might be partial if not fully loaded, but best effort.

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
                {displayedGoing.map((a, i) => (
                    <div
                        key={a.user.id}
                        className="relative transition-transform duration-300 group-hover:scale-110 z-20"
                        style={{ zIndex: 30 - i }} // Stack: First on top
                    >
                        <Avatar
                            src={a.user?.profileImage || undefined}
                            fallback={a.user?.username?.[0] || '?'}
                            size="xs" // "Small dot sized" -> xs (w-6 h-6)
                            bordered
                            className="ring-background-primary dark:ring-neutral-900 ring-2"
                        />
                    </div>
                ))}

                {/* Maybe Group */}
                {displayedMaybe.map((a, i) => (
                    <div
                        key={a.user.id}
                        className="relative transition-all duration-300 group-hover:scale-105 z-10"
                        style={{ zIndex: 10 - i }}
                    >
                        <Avatar
                            src={a.user?.profileImage || undefined}
                            fallback={a.user?.username?.[0] || '?'}
                            size="xs"
                            bordered
                            className="grayscale opacity-60 ring-background-primary dark:ring-neutral-900 ring-2 group-hover:grayscale-0 group-hover:opacity-100"
                        />
                    </div>
                ))}


            </div>

            {/* Text Summary - Fades in/slides on hover */}
            <div className="flex flex-col justify-center text-xs opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 delay-75 pointer-events-none whitespace-nowrap">
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
