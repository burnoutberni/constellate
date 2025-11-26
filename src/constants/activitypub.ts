/**
 * ActivityPub Constants
 * Centralized constants for ActivityPub types, contexts, and URIs
 */

// ActivityPub Context URLs
export const ACTIVITYSTREAMS_CONTEXT = 'https://www.w3.org/ns/activitystreams'
export const W3ID_SECURITY_CONTEXT = 'https://w3id.org/security/v1'

export const ACTIVITYPUB_CONTEXTS = [
    ACTIVITYSTREAMS_CONTEXT,
    W3ID_SECURITY_CONTEXT,
] as const

// Public addressing
export const PUBLIC_COLLECTION = 'https://www.w3.org/ns/activitystreams#Public'

// Activity Types
export const ActivityType = {
    CREATE: 'Create',
    UPDATE: 'Update',
    DELETE: 'Delete',
    FOLLOW: 'Follow',
    ACCEPT: 'Accept',
    REJECT: 'Reject',
    LIKE: 'Like',
    UNDO: 'Undo',
    ANNOUNCE: 'Announce',
    TENTATIVE_ACCEPT: 'TentativeAccept',
    BLOCK: 'Block',
    FLAG: 'Flag',
    ADD: 'Add',
    REMOVE: 'Remove',
} as const

// Object Types
export const ObjectType = {
    PERSON: 'Person',
    EVENT: 'Event',
    NOTE: 'Note',
    PLACE: 'Place',
    IMAGE: 'Image',
    DOCUMENT: 'Document',
    TOMBSTONE: 'Tombstone',
} as const

// Collection Types
export const CollectionType = {
    COLLECTION: 'Collection',
    ORDERED_COLLECTION: 'OrderedCollection',
    COLLECTION_PAGE: 'CollectionPage',
    ORDERED_COLLECTION_PAGE: 'OrderedCollectionPage',
} as const

// Event Status (TypeScript enum for Zod v4 compatibility)
export enum EventStatus {
    SCHEDULED = 'EventScheduled',
    CANCELLED = 'EventCancelled',
    POSTPONED = 'EventPostponed',
}

// Event Attendance Mode (TypeScript enum for Zod v4 compatibility)
export enum EventAttendanceMode {
    OFFLINE = 'OfflineEventAttendanceMode',
    ONLINE = 'OnlineEventAttendanceMode',
    MIXED = 'MixedEventAttendanceMode',
}

// Attendance Status (internal)
export const AttendanceStatus = {
    ATTENDING: 'attending',
    MAYBE: 'maybe',
    NOT_ATTENDING: 'not_attending',
} as const

// Content Types
export const ContentType = {
    ACTIVITY_JSON: 'application/activity+json',
    LD_JSON: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
    JSON: 'application/json',
} as const

// HTTP Headers
export const Headers = {
    CONTENT_TYPE: 'Content-Type',
    ACCEPT: 'Accept',
    SIGNATURE: 'Signature',
    DATE: 'Date',
    DIGEST: 'Digest',
    HOST: 'Host',
} as const

// Pagination
export const PAGINATION = {
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
} as const

// Deduplication
export const ACTIVITY_TTL_DAYS = 30

// Rate Limiting
export const RATE_LIMITS = {
    INBOX: {
        WINDOW_MS: 15 * 60 * 1000, // 15 minutes
        MAX_REQUESTS: 100,
    },
    AUTH: {
        WINDOW_MS: 15 * 60 * 1000, // 15 minutes
        MAX_REQUESTS: 5,
    },
    API: {
        WINDOW_MS: 15 * 60 * 1000, // 15 minutes
        MAX_REQUESTS: 1000,
    },
} as const
