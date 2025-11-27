/**
 * Tests for ActivityPub Zod Schemas
 * Tests validation for ActivityPub objects and activities
 */

import { describe, it, expect } from 'vitest'
import {
    ImageSchema,
    PlaceSchema,
    PublicKeySchema,
    PersonSchema,
    EventSchema,
    NoteSchema,
    TombstoneSchema,
    CreateActivitySchema,
    UpdateActivitySchema,
    DeleteActivitySchema,
    FollowActivitySchema,
    AcceptActivitySchema,
    RejectActivitySchema,
    LikeActivitySchema,
    UndoActivitySchema,
    AnnounceActivitySchema,
    TentativeAcceptActivitySchema,
    BlockActivitySchema,
    FlagActivitySchema,
    ActivitySchema,
    OrderedCollectionSchema,
    OrderedCollectionPageSchema,
    WebFingerSchema,
} from '../../lib/activitypubSchemas.js'

describe('ActivityPub Schemas', () => {
    describe('ImageSchema', () => {
        it('should validate valid image object', () => {
            const image = {
                type: 'Image',
                url: 'https://example.com/image.jpg',
            }

            expect(() => ImageSchema.parse(image)).not.toThrow()
        })

        it('should validate image with optional fields', () => {
            const image = {
                type: 'Image',
                url: 'https://example.com/image.jpg',
                mediaType: 'image/jpeg',
                name: 'Photo',
            }

            expect(() => ImageSchema.parse(image)).not.toThrow()
        })

        it('should reject invalid type', () => {
            const image = {
                type: 'NotImage',
                url: 'https://example.com/image.jpg',
            }

            expect(() => ImageSchema.parse(image)).toThrow()
        })

        it('should reject invalid URL', () => {
            const image = {
                type: 'Image',
                url: 'not-a-url',
            }

            expect(() => ImageSchema.parse(image)).toThrow()
        })
    })

    describe('PlaceSchema', () => {
        it('should validate valid place object', () => {
            const place = {
                type: 'Place',
                name: 'Conference Room',
            }

            expect(() => PlaceSchema.parse(place)).not.toThrow()
        })

        it('should validate place with coordinates', () => {
            const place = {
                type: 'Place',
                name: 'Location',
                latitude: 40.7128,
                longitude: -74.0060,
                address: '123 Main St',
            }

            expect(() => PlaceSchema.parse(place)).not.toThrow()
        })
    })

    describe('PublicKeySchema', () => {
        it('should validate valid public key', () => {
            const publicKey = {
                id: 'https://example.com/users/alice#main-key',
                owner: 'https://example.com/users/alice',
                publicKeyPem: '-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----',
            }

            expect(() => PublicKeySchema.parse(publicKey)).not.toThrow()
        })

        it('should reject invalid URL in id', () => {
            const publicKey = {
                id: 'not-a-url',
                owner: 'https://example.com/users/alice',
                publicKeyPem: 'key',
            }

            expect(() => PublicKeySchema.parse(publicKey)).toThrow()
        })
    })

    describe('PersonSchema', () => {
        it('should validate valid person object', () => {
            const person = {
                '@context': 'https://www.w3.org/ns/activitystreams',
                type: 'Person',
                id: 'https://example.com/users/alice',
                preferredUsername: 'alice',
                inbox: 'https://example.com/users/alice/inbox',
                outbox: 'https://example.com/users/alice/outbox',
            }

            expect(() => PersonSchema.parse(person)).not.toThrow()
        })

        it('should validate person with all optional fields', () => {
            const person = {
                '@context': 'https://www.w3.org/ns/activitystreams',
                type: 'Person',
                id: 'https://example.com/users/alice',
                preferredUsername: 'alice',
                name: 'Alice Smith',
                summary: 'Test user',
                inbox: 'https://example.com/users/alice/inbox',
                outbox: 'https://example.com/users/alice/outbox',
                followers: 'https://example.com/users/alice/followers',
                following: 'https://example.com/users/alice/following',
                publicKey: {
                    id: 'https://example.com/users/alice#main-key',
                    owner: 'https://example.com/users/alice',
                    publicKeyPem: '-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----',
                },
                icon: {
                    type: 'Image',
                    url: 'https://example.com/avatar.jpg',
                },
                image: {
                    type: 'Image',
                    url: 'https://example.com/header.jpg',
                },
                endpoints: {
                    sharedInbox: 'https://example.com/inbox',
                },
                displayColor: '#3b82f6',
            }

            expect(() => PersonSchema.parse(person)).not.toThrow()
        })

        it('should reject person without required fields', () => {
            const person = {
                type: 'Person',
                // Missing id, preferredUsername, inbox, outbox
            }

            expect(() => PersonSchema.parse(person)).toThrow()
        })
    })

    describe('EventSchema', () => {
        it('should validate valid event object', () => {
            const event = {
                type: 'Event',
                id: 'https://example.com/events/123',
                name: 'Team Meeting',
                startTime: '2024-12-01T10:00:00Z',
                attributedTo: 'https://example.com/users/alice',
            }

            expect(() => EventSchema.parse(event)).not.toThrow()
        })

        it('should validate event with all optional fields', () => {
            const event = {
                '@context': 'https://www.w3.org/ns/activitystreams',
                type: 'Event',
                id: 'https://example.com/events/123',
                name: 'Team Meeting',
                summary: 'Weekly sync',
                content: 'Meeting notes',
                startTime: '2024-12-01T10:00:00Z',
                endTime: '2024-12-01T11:00:00Z',
                duration: 'PT1H',
                location: 'Conference Room',
                attachment: [
                    {
                        type: 'Image',
                        url: 'https://example.com/event.jpg',
                    },
                ],
                attributedTo: 'https://example.com/users/alice',
                published: '2024-11-01T10:00:00Z',
                updated: '2024-11-02T10:00:00Z',
                url: 'https://example.com/events/123',
                eventStatus: 'EventScheduled',
                eventAttendanceMode: 'OfflineEventAttendanceMode',
                maximumAttendeeCapacity: 50,
                to: 'https://www.w3.org/ns/activitystreams#Public',
                cc: ['https://example.com/users/alice/followers'],
            }

            expect(() => EventSchema.parse(event)).not.toThrow()
        })

        it('should validate event with Place location', () => {
            const event = {
                type: 'Event',
                id: 'https://example.com/events/123',
                name: 'Team Meeting',
                startTime: '2024-12-01T10:00:00Z',
                location: {
                    type: 'Place',
                    name: 'Conference Room',
                },
                attributedTo: 'https://example.com/users/alice',
            }

            expect(() => EventSchema.parse(event)).not.toThrow()
        })

        it('should reject event without required fields', () => {
            const event = {
                type: 'Event',
                // Missing id, name, startTime, attributedTo
            }

            expect(() => EventSchema.parse(event)).toThrow()
        })
    })

    describe('NoteSchema', () => {
        it('should validate valid note object', () => {
            const note = {
                type: 'Note',
                id: 'https://example.com/notes/123',
                content: 'This is a comment',
                attributedTo: 'https://example.com/users/alice',
            }

            expect(() => NoteSchema.parse(note)).not.toThrow()
        })

        it('should validate note with inReplyTo', () => {
            const note = {
                type: 'Note',
                id: 'https://example.com/notes/123',
                content: 'This is a reply',
                attributedTo: 'https://example.com/users/alice',
                inReplyTo: 'https://example.com/notes/122',
            }

            expect(() => NoteSchema.parse(note)).not.toThrow()
        })
    })

    describe('TombstoneSchema', () => {
        it('should validate valid tombstone object', () => {
            const tombstone = {
                type: 'Tombstone',
                id: 'https://example.com/events/123',
            }

            expect(() => TombstoneSchema.parse(tombstone)).not.toThrow()
        })

        it('should validate tombstone with optional fields', () => {
            const tombstone = {
                type: 'Tombstone',
                id: 'https://example.com/events/123',
                formerType: 'Event',
                deleted: '2024-12-01T10:00:00Z',
            }

            expect(() => TombstoneSchema.parse(tombstone)).not.toThrow()
        })
    })

    describe('CreateActivitySchema', () => {
        it('should validate valid Create activity', () => {
            const activity = {
                '@context': 'https://www.w3.org/ns/activitystreams',
                type: 'Create',
                id: 'https://example.com/activities/123',
                actor: 'https://example.com/users/alice',
                object: {
                    type: 'Event',
                    id: 'https://example.com/events/123',
                    name: 'Team Meeting',
                    startTime: '2024-12-01T10:00:00Z',
                    attributedTo: 'https://example.com/users/alice',
                },
            }

            expect(() => CreateActivitySchema.parse(activity)).not.toThrow()
        })

        it('should validate Create activity with Note object', () => {
            const activity = {
                type: 'Create',
                id: 'https://example.com/activities/123',
                actor: 'https://example.com/users/alice',
                object: {
                    type: 'Note',
                    id: 'https://example.com/notes/123',
                    content: 'Comment',
                    attributedTo: 'https://example.com/users/alice',
                },
            }

            expect(() => CreateActivitySchema.parse(activity)).not.toThrow()
        })
    })

    describe('UpdateActivitySchema', () => {
        it('should validate valid Update activity', () => {
            const activity = {
                type: 'Update',
                id: 'https://example.com/activities/123',
                actor: 'https://example.com/users/alice',
                object: {
                    type: 'Event',
                    id: 'https://example.com/events/123',
                    name: 'Updated Meeting',
                    startTime: '2024-12-01T10:00:00Z',
                    attributedTo: 'https://example.com/users/alice',
                },
            }

            expect(() => UpdateActivitySchema.parse(activity)).not.toThrow()
        })

        it('should validate Update activity with Person object', () => {
            const activity = {
                type: 'Update',
                id: 'https://example.com/activities/123',
                actor: 'https://example.com/users/alice',
                object: {
                    type: 'Person',
                    id: 'https://example.com/users/alice',
                    preferredUsername: 'alice',
                    inbox: 'https://example.com/users/alice/inbox',
                    outbox: 'https://example.com/users/alice/outbox',
                },
            }

            expect(() => UpdateActivitySchema.parse(activity)).not.toThrow()
        })
    })

    describe('DeleteActivitySchema', () => {
        it('should validate Delete activity with URL', () => {
            const activity = {
                type: 'Delete',
                id: 'https://example.com/activities/123',
                actor: 'https://example.com/users/alice',
                object: 'https://example.com/events/123',
            }

            expect(() => DeleteActivitySchema.parse(activity)).not.toThrow()
        })

        it('should validate Delete activity with Tombstone', () => {
            const activity = {
                type: 'Delete',
                id: 'https://example.com/activities/123',
                actor: 'https://example.com/users/alice',
                object: {
                    type: 'Tombstone',
                    id: 'https://example.com/events/123',
                },
            }

            expect(() => DeleteActivitySchema.parse(activity)).not.toThrow()
        })
    })

    describe('FollowActivitySchema', () => {
        it('should validate valid Follow activity', () => {
            const activity = {
                type: 'Follow',
                id: 'https://example.com/activities/123',
                actor: 'https://example.com/users/alice',
                object: 'https://example.com/users/bob',
            }

            expect(() => FollowActivitySchema.parse(activity)).not.toThrow()
        })
    })

    describe('AcceptActivitySchema', () => {
        it('should validate Accept activity with URL', () => {
            const activity = {
                type: 'Accept',
                id: 'https://example.com/activities/123',
                actor: 'https://example.com/users/alice',
                object: 'https://example.com/activities/122',
            }

            expect(() => AcceptActivitySchema.parse(activity)).not.toThrow()
        })

        it('should validate Accept activity with Follow activity', () => {
            const activity = {
                type: 'Accept',
                id: 'https://example.com/activities/123',
                actor: 'https://example.com/users/alice',
                object: {
                    type: 'Follow',
                    id: 'https://example.com/activities/122',
                    actor: 'https://example.com/users/bob',
                    object: 'https://example.com/users/alice',
                },
            }

            expect(() => AcceptActivitySchema.parse(activity)).not.toThrow()
        })
    })

    describe('RejectActivitySchema', () => {
        it('should validate valid Reject activity', () => {
            const activity = {
                type: 'Reject',
                id: 'https://example.com/activities/123',
                actor: 'https://example.com/users/alice',
                object: 'https://example.com/activities/122',
            }

            expect(() => RejectActivitySchema.parse(activity)).not.toThrow()
        })
    })

    describe('LikeActivitySchema', () => {
        it('should validate valid Like activity', () => {
            const activity = {
                type: 'Like',
                id: 'https://example.com/activities/123',
                actor: 'https://example.com/users/alice',
                object: 'https://example.com/events/123',
            }

            expect(() => LikeActivitySchema.parse(activity)).not.toThrow()
        })
    })

    describe('UndoActivitySchema', () => {
        it('should validate Undo activity with URL', () => {
            const activity = {
                type: 'Undo',
                id: 'https://example.com/activities/123',
                actor: 'https://example.com/users/alice',
                object: 'https://example.com/activities/122',
            }

            expect(() => UndoActivitySchema.parse(activity)).not.toThrow()
        })

        it('should validate Undo activity with object', () => {
            const activity = {
                type: 'Undo',
                id: 'https://example.com/activities/123',
                actor: 'https://example.com/users/alice',
                object: {
                    id: 'https://example.com/activities/122',
                    type: 'Like',
                },
            }

            expect(() => UndoActivitySchema.parse(activity)).not.toThrow()
        })
    })

    describe('AnnounceActivitySchema', () => {
        it('should validate valid Announce activity', () => {
            const activity = {
                type: 'Announce',
                id: 'https://example.com/activities/123',
                actor: 'https://example.com/users/alice',
                object: 'https://example.com/events/123',
            }

            expect(() => AnnounceActivitySchema.parse(activity)).not.toThrow()
        })
    })

    describe('TentativeAcceptActivitySchema', () => {
        it('should validate valid TentativeAccept activity', () => {
            const activity = {
                type: 'TentativeAccept',
                id: 'https://example.com/activities/123',
                actor: 'https://example.com/users/alice',
                object: 'https://example.com/events/123',
            }

            expect(() => TentativeAcceptActivitySchema.parse(activity)).not.toThrow()
        })
    })

    describe('BlockActivitySchema', () => {
        it('should validate valid Block activity', () => {
            const activity = {
                type: 'Block',
                id: 'https://example.com/activities/123',
                actor: 'https://example.com/users/alice',
                object: 'https://example.com/users/bob',
            }

            expect(() => BlockActivitySchema.parse(activity)).not.toThrow()
        })
    })

    describe('FlagActivitySchema', () => {
        it('should validate Flag activity with URL', () => {
            const activity = {
                type: 'Flag',
                id: 'https://example.com/activities/123',
                actor: 'https://example.com/users/alice',
                object: 'https://example.com/events/123',
                content: 'This is spam',
            }

            expect(() => FlagActivitySchema.parse(activity)).not.toThrow()
        })

        it('should validate Flag activity with array of URLs', () => {
            const activity = {
                type: 'Flag',
                id: 'https://example.com/activities/123',
                actor: 'https://example.com/users/alice',
                object: [
                    'https://example.com/events/123',
                    'https://example.com/events/124',
                ],
            }

            expect(() => FlagActivitySchema.parse(activity)).not.toThrow()
        })
    })

    describe('ActivitySchema', () => {
        it('should validate any activity type', () => {
            const createActivity = {
                type: 'Create',
                id: 'https://example.com/activities/123',
                actor: 'https://example.com/users/alice',
                object: {
                    type: 'Event',
                    id: 'https://example.com/events/123',
                    name: 'Meeting',
                    startTime: '2024-12-01T10:00:00Z',
                    attributedTo: 'https://example.com/users/alice',
                },
            }

            expect(() => ActivitySchema.parse(createActivity)).not.toThrow()
        })
    })

    describe('OrderedCollectionSchema', () => {
        it('should validate valid ordered collection', () => {
            const collection = {
                '@context': 'https://www.w3.org/ns/activitystreams',
                type: 'OrderedCollection',
                id: 'https://example.com/collection',
                totalItems: 10,
            }

            expect(() => OrderedCollectionSchema.parse(collection)).not.toThrow()
        })

        it('should validate collection with items', () => {
            const collection = {
                type: 'OrderedCollection',
                id: 'https://example.com/collection',
                totalItems: 2,
                orderedItems: [
                    'https://example.com/items/1',
                    'https://example.com/items/2',
                ],
            }

            expect(() => OrderedCollectionSchema.parse(collection)).not.toThrow()
        })
    })

    describe('OrderedCollectionPageSchema', () => {
        it('should validate valid ordered collection page', () => {
            const page = {
                '@context': 'https://www.w3.org/ns/activitystreams',
                type: 'OrderedCollectionPage',
                id: 'https://example.com/collection/page1',
                partOf: 'https://example.com/collection',
                orderedItems: ['https://example.com/items/1'],
            }

            expect(() => OrderedCollectionPageSchema.parse(page)).not.toThrow()
        })

        it('should validate page with next and prev links', () => {
            const page = {
                type: 'OrderedCollectionPage',
                id: 'https://example.com/collection/page2',
                partOf: 'https://example.com/collection',
                orderedItems: ['https://example.com/items/2'],
                next: 'https://example.com/collection/page3',
                prev: 'https://example.com/collection/page1',
            }

            expect(() => OrderedCollectionPageSchema.parse(page)).not.toThrow()
        })
    })

    describe('WebFingerSchema', () => {
        it('should validate valid WebFinger response', () => {
            const webfinger = {
                subject: 'acct:alice@example.com',
                aliases: ['https://example.com/users/alice'],
                links: [
                    {
                        rel: 'self',
                        type: 'application/activity+json',
                        href: 'https://example.com/users/alice',
                    },
                ],
            }

            expect(() => WebFingerSchema.parse(webfinger)).not.toThrow()
        })

        it('should validate WebFinger without optional fields', () => {
            const webfinger = {
                subject: 'acct:alice@example.com',
                links: [
                    {
                        rel: 'self',
                    },
                ],
            }

            expect(() => WebFingerSchema.parse(webfinger)).not.toThrow()
        })
    })
})

