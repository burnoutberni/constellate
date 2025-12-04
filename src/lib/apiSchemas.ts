/**
 * Shared API Schemas for OpenAPI Documentation
 */

import { z } from '@hono/zod-openapi'

// Common response schemas
export const ErrorSchema = z.object({
    error: z.string().openapi({ example: 'An error occurred' }),
    details: z.any().optional(),
}).openapi('Error')

export const SuccessSchema = z.object({
    message: z.string().openapi({ example: 'Operation successful' }),
}).openapi('Success')

// User schemas
export const UserSchema = z.object({
    id: z.string().openapi({ example: 'user_123' }),
    username: z.string().openapi({ example: 'alice' }),
    name: z.string().nullable().openapi({ example: 'Alice Smith' }),
    displayColor: z.string().nullable().openapi({ example: '#3b82f6' }),
    profileImage: z.string().nullable().openapi({ example: 'https://example.com/avatar.jpg' }),
    isRemote: z.boolean().optional(),
    externalActorUrl: z.string().nullable().optional(),
}).openapi('User')

// Event schemas
export const EventInputSchema = z.object({
    title: z.string().min(1).max(200).openapi({ example: 'Team Meeting' }),
    summary: z.string().optional().openapi({ example: 'Weekly team sync' }),
    location: z.string().optional().openapi({ example: 'Conference Room A' }),
    headerImage: z.string().url().optional().openapi({ example: 'https://example.com/event.jpg' }),
    url: z.string().url().optional().openapi({ example: 'https://meet.example.com/abc123' }),
    startTime: z.string().datetime().openapi({ example: '2024-12-01T10:00:00Z' }),
    endTime: z.string().datetime().optional().openapi({ example: '2024-12-01T11:00:00Z' }),
    duration: z.string().optional().openapi({ example: 'PT1H' }),
    eventStatus: z.enum(['EventScheduled', 'EventCancelled', 'EventPostponed']).optional().openapi({ example: 'EventScheduled' }),
    eventAttendanceMode: z.enum(['OfflineEventAttendanceMode', 'OnlineEventAttendanceMode', 'MixedEventAttendanceMode']).optional().openapi({ example: 'MixedEventAttendanceMode' }),
    maximumAttendeeCapacity: z.number().int().positive().optional().openapi({ example: 50 }),
}).openapi('EventInput')

export const EventSchema = z.object({
    id: z.string().openapi({ example: 'event_123' }),
    title: z.string().openapi({ example: 'Team Meeting' }),
    summary: z.string().nullable(),
    location: z.string().nullable(),
    headerImage: z.string().nullable(),
    url: z.string().nullable(),
    startTime: z.string().datetime(),
    endTime: z.string().datetime().nullable(),
    duration: z.string().nullable(),
    eventStatus: z.string().nullable(),
    eventAttendanceMode: z.string().nullable(),
    maximumAttendeeCapacity: z.number().nullable(),
    userId: z.string().nullable(),
    attributedTo: z.string(),
    externalId: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    user: UserSchema.nullable(),
    _count: z.object({
        attendance: z.number(),
        likes: z.number(),
        comments: z.number(),
    }).optional(),
}).openapi('Event')

export const EventListSchema = z.object({
    events: z.array(EventSchema),
    pagination: z.object({
        page: z.number(),
        limit: z.number(),
        total: z.number(),
        pages: z.number(),
    }),
}).openapi('EventList')

export const EventTemplateDataSchema = z.object({
    title: z.string().min(1).max(200).openapi({ example: 'Team Meeting' }),
    summary: z.string().optional().openapi({ example: 'Weekly sync-up' }),
    location: z.string().optional().openapi({ example: 'Conference Room A' }),
    headerImage: z.string().url().optional().openapi({ example: 'https://example.com/event.jpg' }),
    url: z.string().url().optional().openapi({ example: 'https://meet.example.com/abc123' }),
    startTime: z.string().datetime().optional().openapi({ example: '2024-12-01T10:00:00Z' }),
    endTime: z.string().datetime().optional().openapi({ example: '2024-12-01T11:00:00Z' }),
    duration: z.string().optional().openapi({ example: 'PT1H' }),
    eventStatus: z.enum(['EventScheduled', 'EventCancelled', 'EventPostponed']).optional().openapi({ example: 'EventScheduled' }),
    eventAttendanceMode: z.enum(['OfflineEventAttendanceMode', 'OnlineEventAttendanceMode', 'MixedEventAttendanceMode']).optional().openapi({ example: 'MixedEventAttendanceMode' }),
    maximumAttendeeCapacity: z.number().int().positive().optional().openapi({ example: 50 }),
}).openapi('EventTemplateData')

export const EventTemplateInputSchema = z.object({
    name: z.string().min(1).max(120).openapi({ example: 'Weekly Standup' }),
    description: z.string().max(500).optional().openapi({ example: 'Use for recurring standups' }),
    data: EventTemplateDataSchema,
}).openapi('EventTemplateInput')

export const EventTemplateSchema = z.object({
    id: z.string().openapi({ example: 'tmpl_123' }),
    name: z.string().openapi({ example: 'Weekly Standup' }),
    description: z.string().nullable().openapi({ example: 'Use for recurring standups' }),
    data: EventTemplateDataSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
}).openapi('EventTemplate')

export const EventTemplateListSchema = z.object({
    templates: z.array(EventTemplateSchema),
}).openapi('EventTemplateList')

// Attendance schemas
export const AttendanceInputSchema = z.object({
    status: z.enum(['attending', 'maybe', 'not_attending']).openapi({ example: 'attending' }),
}).openapi('AttendanceInput')

export const AttendanceSchema = z.object({
    id: z.string(),
    status: z.string(),
    userId: z.string(),
    eventId: z.string(),
    createdAt: z.string().datetime(),
    user: UserSchema.nullable(),
}).openapi('Attendance')

// Comment schemas
export const CommentInputSchema = z.object({
    content: z.string().min(1).max(5000).openapi({ example: 'Looking forward to this!' }),
}).openapi('CommentInput')

export const CommentSchema = z.object({
    id: z.string(),
    content: z.string(),
    authorId: z.string(),
    eventId: z.string(),
    inReplyToId: z.string().nullable(),
    externalId: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    author: UserSchema,
    replies: z.array(z.any()).optional(),
}).openapi('Comment')

// Profile schemas
export const ProfileUpdateSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    bio: z.string().max(500).optional(),
    profileImage: z.string().url().optional(),
    headerImage: z.string().url().optional(),
    displayColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().openapi({ example: '#3b82f6' }),
}).openapi('ProfileUpdate')

export const ProfileSchema = z.object({
    id: z.string(),
    username: z.string(),
    name: z.string().nullable(),
    email: z.string().nullable(),
    bio: z.string().nullable(),
    profileImage: z.string().nullable(),
    headerImage: z.string().nullable(),
    displayColor: z.string().nullable(),
    createdAt: z.string().datetime(),
    _count: z.object({
        followers: z.number(),
        following: z.number(),
    }).optional(),
}).openapi('Profile')
