import { z } from 'zod'

export const EventUserSchema = z.object({
    id: z.string(),
    username: z.string(),
    name: z.string().nullable().optional(),
    displayColor: z.string().optional(),
    profileImage: z.string().nullable().optional(),
    isRemote: z.boolean(),
})

export const TagSchema = z.object({
    id: z.string(),
    tag: z.string(),
})

export const EventSchema = z.object({
    id: z.string(),
    title: z.string(),
    startTime: z.string(),
    endTime: z.string().nullable().optional(),
    timezone: z.string().default('UTC'),
    summary: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    headerImage: z.string().nullable().optional(),
    user: EventUserSchema.nullable().optional(),
    userId: z.string().optional(),
    visibility: z.enum(['PUBLIC', 'FOLLOWERS', 'PRIVATE', 'UNLISTED']).optional(),
    tags: z.array(TagSchema).default([]),
    _count: z.object({
        attendance: z.number(),
        likes: z.number(),
        comments: z.number(),
    }).optional(),
    attendance: z.array(z.object({
        status: z.string(),
        user: EventUserSchema,
    })).optional(),
    viewerStatus: z.enum(['attending', 'maybe', 'not_attending']).nullable().optional(),
}).passthrough()

export const ActivitySchema = z.object({
    id: z.string(),
    type: z.string(),
    createdAt: z.string(),
    user: EventUserSchema,
    event: EventSchema,
})

export const SuggestedUserSchema = z.object({
    id: z.string(),
    username: z.string(),
    name: z.string().nullable(),
    displayColor: z.string(),
    profileImage: z.string().nullable(),
    bio: z.string().nullable().optional(),
    _count: z.object({
        followers: z.number(),
        events: z.number()
    }).optional()
})

export const SuggestedUsersSchema = z.object({
    suggestions: z.array(SuggestedUserSchema)
})

export const HeaderSchema = z.object({
    title: z.string(),
})

// Validation types
export type ValidatedSuggestedUsers = z.infer<typeof SuggestedUsersSchema>
export type ValidatedEvent = z.infer<typeof EventSchema>
export type ValidatedActivity = z.infer<typeof ActivitySchema>
export type ValidatedHeader = z.infer<typeof HeaderSchema>
