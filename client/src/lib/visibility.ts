import type { EventVisibility } from '@/types'

export const VISIBILITY_OPTIONS: Array<{
    value: EventVisibility
    label: string
    description: string
}> = [
    {
        value: 'PUBLIC',
        label: 'Public',
        description: 'Visible to everyone and discoverable in feeds.',
    },
    {
        value: 'FOLLOWERS',
        label: 'Followers only',
        description: 'Only people who follow you can see this event.',
    },
    {
        value: 'UNLISTED',
        label: 'Unlisted',
        description: 'Hidden from feeds but shareable with a direct link.',
    },
    {
        value: 'PRIVATE',
        label: 'Private',
        description: 'Only you can view this event.',
    },
]

const VISIBILITY_META: Record<
    EventVisibility,
    {
        label: string
        icon: string
        badgeClass: string
        variant: 'primary' | 'info' | 'warning' | 'error'
        helper: string
    }
> = {
    PUBLIC: {
        label: 'Public',
        icon: '🌍',
        badgeClass: 'badge-primary',
        variant: 'primary',
        helper: 'Everyone can discover this event.',
    },
    FOLLOWERS: {
        label: 'Followers only',
        icon: '👥',
        badgeClass: 'badge-followers',
        variant: 'info',
        helper: 'Only approved followers can see this event.',
    },
    UNLISTED: {
        label: 'Unlisted',
        icon: '🔗',
        badgeClass: 'badge-neutral',
        variant: 'warning',
        helper: 'Hidden from feeds—share the link with people you trust.',
    },
    PRIVATE: {
        label: 'Private',
        icon: '🔒',
        badgeClass: 'badge-private',
        variant: 'error',
        helper: 'Only you can view this event.',
    },
}

export function getVisibilityMeta(value: EventVisibility = 'PUBLIC') {
    return VISIBILITY_META[value]
}
