import { describe, it, expect } from 'vitest'
import {
    ErrorSchema,
    SuccessSchema,
    UserSchema,
    EventInputSchema,
    EventSchema,
    EventListSchema,
    AttendanceInputSchema,
    AttendanceSchema,
    CommentInputSchema,
    CommentSchema,
    ProfileUpdateSchema,
    ProfileSchema,
} from '../../lib/apiSchemas.js'

describe('API Schemas', () => {
    describe('ErrorSchema', () => {
        it('should parse valid error object', () => {
            const valid = { error: 'An error occurred', message: 'An error occurred' }
            const result = ErrorSchema.safeParse(valid)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.error).toBe('An error occurred')
            }
        })

        it('should parse error with optional details', () => {
            const valid = { error: 'An error occurred', message: 'An error occurred', details: { field: 'value' } }
            const result = ErrorSchema.safeParse(valid)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.details).toEqual({ field: 'value' })
            }
        })

        it('should reject missing error field', () => {
            const invalid = { message: 'An error occurred' }
            const result = ErrorSchema.safeParse(invalid)
            expect(result.success).toBe(false)
        })

        it('should reject missing message field', () => {
            const invalid = { error: 'An error occurred' }
            const result = ErrorSchema.safeParse(invalid)
            expect(result.success).toBe(false)
        })

        it('should reject non-string error field', () => {
            const invalid = { error: 123, message: 'An error occurred' }
            const result = ErrorSchema.safeParse(invalid)
            expect(result.success).toBe(false)
        })
    })

    describe('SuccessSchema', () => {
        it('should parse valid success object', () => {
            const valid = { message: 'Operation successful' }
            const result = SuccessSchema.safeParse(valid)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.message).toBe('Operation successful')
            }
        })

        it('should reject missing message field', () => {
            const invalid = {}
            const result = SuccessSchema.safeParse(invalid)
            expect(result.success).toBe(false)
        })
    })

    describe('UserSchema', () => {
        it('should parse valid user object', () => {
            const valid = {
                id: 'user_123',
                username: 'alice',
                name: 'Alice Smith',
                displayColor: '#3b82f6',
                profileImage: 'https://example.com/avatar.jpg',
            }
            const result = UserSchema.safeParse(valid)
            expect(result.success).toBe(true)
        })

        it('should parse user with null optional fields', () => {
            const valid = {
                id: 'user_123',
                username: 'alice',
                name: null,
                displayColor: null,
                profileImage: null,
            }
            const result = UserSchema.safeParse(valid)
            expect(result.success).toBe(true)
        })

        it('should parse user with optional boolean fields', () => {
            const valid = {
                id: 'user_123',
                username: 'alice',
                name: null,
                displayColor: null,
                profileImage: null,
                isRemote: true,
                externalActorUrl: 'https://example.com/users/alice',
            }
            const result = UserSchema.safeParse(valid)
            expect(result.success).toBe(true)
        })

        it('should reject missing required fields', () => {
            const invalid = { username: 'alice' }
            const result = UserSchema.safeParse(invalid)
            expect(result.success).toBe(false)
        })
    })

    describe('EventInputSchema', () => {
        it('should parse valid event input', () => {
            const valid = {
                title: 'Team Meeting',
                summary: 'Weekly team sync',
                location: 'Conference Room A',
                headerImage: 'https://example.com/event.jpg',
                url: 'https://meet.example.com/abc123',
                startTime: '2024-12-01T10:00:00Z',
                endTime: '2024-12-01T11:00:00Z',
                duration: 'PT1H',
                eventStatus: 'EventScheduled' as const,
                eventAttendanceMode: 'MixedEventAttendanceMode' as const,
                maximumAttendeeCapacity: 50,
            }
            const result = EventInputSchema.safeParse(valid)
            expect(result.success).toBe(true)
        })

        it('should parse minimal event input', () => {
            const valid = {
                title: 'Team Meeting',
                startTime: '2024-12-01T10:00:00Z',
            }
            const result = EventInputSchema.safeParse(valid)
            expect(result.success).toBe(true)
        })

        it('should reject empty title', () => {
            const invalid = {
                title: '',
                startTime: '2024-12-01T10:00:00Z',
            }
            const result = EventInputSchema.safeParse(invalid)
            expect(result.success).toBe(false)
        })

        it('should reject title exceeding max length', () => {
            const invalid = {
                title: 'a'.repeat(201),
                startTime: '2024-12-01T10:00:00Z',
            }
            const result = EventInputSchema.safeParse(invalid)
            expect(result.success).toBe(false)
        })

        it('should reject invalid URL', () => {
            const invalid = {
                title: 'Team Meeting',
                startTime: '2024-12-01T10:00:00Z',
                url: 'not-a-url',
            }
            const result = EventInputSchema.safeParse(invalid)
            expect(result.success).toBe(false)
        })

        it('should reject invalid datetime', () => {
            const invalid = {
                title: 'Team Meeting',
                startTime: 'invalid-datetime',
            }
            const result = EventInputSchema.safeParse(invalid)
            expect(result.success).toBe(false)
        })

        it('should reject invalid event status', () => {
            const invalid = {
                title: 'Team Meeting',
                startTime: '2024-12-01T10:00:00Z',
                eventStatus: 'InvalidStatus',
            }
            const result = EventInputSchema.safeParse(invalid)
            expect(result.success).toBe(false)
        })

        it('should reject negative maximumAttendeeCapacity', () => {
            const invalid = {
                title: 'Team Meeting',
                startTime: '2024-12-01T10:00:00Z',
                maximumAttendeeCapacity: -1,
            }
            const result = EventInputSchema.safeParse(invalid)
            expect(result.success).toBe(false)
        })

        it('should reject non-integer maximumAttendeeCapacity', () => {
            const invalid = {
                title: 'Team Meeting',
                startTime: '2024-12-01T10:00:00Z',
                maximumAttendeeCapacity: 50.5,
            }
            const result = EventInputSchema.safeParse(invalid)
            expect(result.success).toBe(false)
        })
    })

    describe('EventSchema', () => {
        it('should parse valid event object', () => {
            const valid = {
                id: 'event_123',
                title: 'Team Meeting',
                summary: 'Weekly team sync',
                location: 'Conference Room A',
                headerImage: 'https://example.com/event.jpg',
                url: 'https://meet.example.com/abc123',
                startTime: '2024-12-01T10:00:00Z',
                endTime: '2024-12-01T11:00:00Z',
                duration: 'PT1H',
                eventStatus: 'EventScheduled',
                eventAttendanceMode: 'MixedEventAttendanceMode',
                maximumAttendeeCapacity: 50,
                userId: 'user_123',
                attributedTo: 'https://example.com/users/alice',
                externalId: null,
                createdAt: '2024-12-01T09:00:00Z',
                updatedAt: '2024-12-01T09:00:00Z',
                user: {
                    id: 'user_123',
                    username: 'alice',
                    name: 'Alice Smith',
                    displayColor: '#3b82f6',
                    profileImage: null,
                },
                _count: {
                    attendance: 5,
                    likes: 10,
                    comments: 3,
                },
            }
            const result = EventSchema.safeParse(valid)
            expect(result.success).toBe(true)
        })

        it('should parse event with null optional fields', () => {
            const valid = {
                id: 'event_123',
                title: 'Team Meeting',
                summary: null,
                location: null,
                headerImage: null,
                url: null,
                startTime: '2024-12-01T10:00:00Z',
                endTime: null,
                duration: null,
                eventStatus: null,
                eventAttendanceMode: null,
                maximumAttendeeCapacity: null,
                userId: null,
                attributedTo: 'https://example.com/users/alice',
                externalId: null,
                createdAt: '2024-12-01T09:00:00Z',
                updatedAt: '2024-12-01T09:00:00Z',
                user: null,
            }
            const result = EventSchema.safeParse(valid)
            expect(result.success).toBe(true)
        })
    })

    describe('EventListSchema', () => {
        it('should parse valid event list', () => {
            const valid = {
                events: [
                    {
                        id: 'event_123',
                        title: 'Team Meeting',
                        summary: null,
                        location: null,
                        headerImage: null,
                        url: null,
                        startTime: '2024-12-01T10:00:00Z',
                        endTime: null,
                        duration: null,
                        eventStatus: null,
                        eventAttendanceMode: null,
                        maximumAttendeeCapacity: null,
                        userId: null,
                        attributedTo: 'https://example.com/users/alice',
                        externalId: null,
                        createdAt: '2024-12-01T09:00:00Z',
                        updatedAt: '2024-12-01T09:00:00Z',
                        user: null,
                    },
                ],
                pagination: {
                    page: 1,
                    limit: 10,
                    total: 1,
                    pages: 1,
                },
            }
            const result = EventListSchema.safeParse(valid)
            expect(result.success).toBe(true)
        })

        it('should parse empty event list', () => {
            const valid = {
                events: [],
                pagination: {
                    page: 1,
                    limit: 10,
                    total: 0,
                    pages: 0,
                },
            }
            const result = EventListSchema.safeParse(valid)
            expect(result.success).toBe(true)
        })
    })

    describe('AttendanceInputSchema', () => {
        it('should parse valid attendance input', () => {
            const valid = { status: 'attending' as const }
            const result = AttendanceInputSchema.safeParse(valid)
            expect(result.success).toBe(true)
        })

        it('should parse maybe status', () => {
            const valid = { status: 'maybe' as const }
            const result = AttendanceInputSchema.safeParse(valid)
            expect(result.success).toBe(true)
        })

        it('should parse not_attending status', () => {
            const valid = { status: 'not_attending' as const }
            const result = AttendanceInputSchema.safeParse(valid)
            expect(result.success).toBe(true)
        })

        it('should reject invalid status', () => {
            const invalid = { status: 'invalid' }
            const result = AttendanceInputSchema.safeParse(invalid)
            expect(result.success).toBe(false)
        })
    })

    describe('AttendanceSchema', () => {
        it('should parse valid attendance object', () => {
            const valid = {
                id: 'attendance_123',
                status: 'attending',
                userId: 'user_123',
                eventId: 'event_123',
                createdAt: '2024-12-01T09:00:00Z',
                user: {
                    id: 'user_123',
                    username: 'alice',
                    name: 'Alice Smith',
                    displayColor: null,
                    profileImage: null,
                },
            }
            const result = AttendanceSchema.safeParse(valid)
            expect(result.success).toBe(true)
        })

        it('should parse attendance with null user', () => {
            const valid = {
                id: 'attendance_123',
                status: 'attending',
                userId: 'user_123',
                eventId: 'event_123',
                createdAt: '2024-12-01T09:00:00Z',
                user: null,
            }
            const result = AttendanceSchema.safeParse(valid)
            expect(result.success).toBe(true)
        })
    })

    describe('CommentInputSchema', () => {
        it('should parse valid comment input', () => {
            const valid = { content: 'Looking forward to this!' }
            const result = CommentInputSchema.safeParse(valid)
            expect(result.success).toBe(true)
        })

        it('should reject empty content', () => {
            const invalid = { content: '' }
            const result = CommentInputSchema.safeParse(invalid)
            expect(result.success).toBe(false)
        })

        it('should reject content exceeding max length', () => {
            const invalid = { content: 'a'.repeat(5001) }
            const result = CommentInputSchema.safeParse(invalid)
            expect(result.success).toBe(false)
        })

        it('should accept content at max length', () => {
            const valid = { content: 'a'.repeat(5000) }
            const result = CommentInputSchema.safeParse(valid)
            expect(result.success).toBe(true)
        })
    })

    describe('CommentSchema', () => {
        it('should parse valid comment object', () => {
            const valid = {
                id: 'comment_123',
                content: 'Looking forward to this!',
                authorId: 'user_123',
                eventId: 'event_123',
                inReplyToId: null,
                externalId: null,
                createdAt: '2024-12-01T09:00:00Z',
                updatedAt: '2024-12-01T09:00:00Z',
                author: {
                    id: 'user_123',
                    username: 'alice',
                    name: 'Alice Smith',
                    displayColor: null,
                    profileImage: null,
                },
            }
            const result = CommentSchema.safeParse(valid)
            expect(result.success).toBe(true)
        })

        it('should parse comment with replies', () => {
            const valid = {
                id: 'comment_123',
                content: 'Looking forward to this!',
                authorId: 'user_123',
                eventId: 'event_123',
                inReplyToId: null,
                externalId: null,
                createdAt: '2024-12-01T09:00:00Z',
                updatedAt: '2024-12-01T09:00:00Z',
                author: {
                    id: 'user_123',
                    username: 'alice',
                    name: 'Alice Smith',
                    displayColor: null,
                    profileImage: null,
                },
                replies: [],
            }
            const result = CommentSchema.safeParse(valid)
            expect(result.success).toBe(true)
        })
    })

    describe('ProfileUpdateSchema', () => {
        it('should parse valid profile update', () => {
            const valid = {
                name: 'Alice Smith',
                bio: 'Software developer',
                profileImage: 'https://example.com/avatar.jpg',
                headerImage: 'https://example.com/header.jpg',
                displayColor: '#3b82f6',
            }
            const result = ProfileUpdateSchema.safeParse(valid)
            expect(result.success).toBe(true)
        })

        it('should parse partial profile update', () => {
            const valid = { name: 'Alice Smith' }
            const result = ProfileUpdateSchema.safeParse(valid)
            expect(result.success).toBe(true)
        })

        it('should parse empty profile update', () => {
            const valid = {}
            const result = ProfileUpdateSchema.safeParse(valid)
            expect(result.success).toBe(true)
        })

        it('should reject name exceeding max length', () => {
            const invalid = { name: 'a'.repeat(101) }
            const result = ProfileUpdateSchema.safeParse(invalid)
            expect(result.success).toBe(false)
        })

        it('should reject empty name', () => {
            const invalid = { name: '' }
            const result = ProfileUpdateSchema.safeParse(invalid)
            expect(result.success).toBe(false)
        })

        it('should reject bio exceeding max length', () => {
            const invalid = { bio: 'a'.repeat(501) }
            const result = ProfileUpdateSchema.safeParse(invalid)
            expect(result.success).toBe(false)
        })

        it('should reject invalid URL', () => {
            const invalid = { profileImage: 'not-a-url' }
            const result = ProfileUpdateSchema.safeParse(invalid)
            expect(result.success).toBe(false)
        })

        it('should reject invalid display color format', () => {
            const invalid = { displayColor: 'not-a-color' }
            const result = ProfileUpdateSchema.safeParse(invalid)
            expect(result.success).toBe(false)
        })

        it('should reject display color without hash', () => {
            const invalid = { displayColor: '3b82f6' }
            const result = ProfileUpdateSchema.safeParse(invalid)
            expect(result.success).toBe(false)
        })

        it('should accept valid hex color', () => {
            const valid = { displayColor: '#3b82f6' }
            const result = ProfileUpdateSchema.safeParse(valid)
            expect(result.success).toBe(true)
        })

        it('should accept lowercase hex color', () => {
            const valid = { displayColor: '#abcdef' }
            const result = ProfileUpdateSchema.safeParse(valid)
            expect(result.success).toBe(true)
        })

        it('should accept uppercase hex color', () => {
            const valid = { displayColor: '#ABCDEF' }
            const result = ProfileUpdateSchema.safeParse(valid)
            expect(result.success).toBe(true)
        })
    })

    describe('ProfileSchema', () => {
        it('should parse valid profile object', () => {
            const valid = {
                id: 'user_123',
                username: 'alice',
                name: 'Alice Smith',
                email: 'alice@example.com',
                bio: 'Software developer',
                profileImage: 'https://example.com/avatar.jpg',
                headerImage: 'https://example.com/header.jpg',
                displayColor: '#3b82f6',
                createdAt: '2024-12-01T09:00:00Z',
                _count: {
                    followers: 10,
                    following: 5,
                },
            }
            const result = ProfileSchema.safeParse(valid)
            expect(result.success).toBe(true)
        })

        it('should parse profile with null optional fields', () => {
            const valid = {
                id: 'user_123',
                username: 'alice',
                name: null,
                email: null,
                bio: null,
                profileImage: null,
                headerImage: null,
                displayColor: null,
                createdAt: '2024-12-01T09:00:00Z',
            }
            const result = ProfileSchema.safeParse(valid)
            expect(result.success).toBe(true)
        })
    })
})

