/**
 * ActivityPub Zod Schemas
 * Type-safe validation for ActivityPub objects and activities
 */

import { z } from '@hono/zod-openapi'
import {
    ActivityType,
    ObjectType,
    CollectionType,
    EventStatus,
    EventAttendanceMode,
} from '../constants/activitypub.js'

// Base schemas
const urlOrArray = z.union([z.string().url(), z.array(z.string().url())])

// Image schema
export const ImageSchema = z.object({
    type: z.literal(ObjectType.IMAGE),
    url: z.string().url(),
    mediaType: z.string().optional(),
    name: z.string().optional(),
})

// Place schema
export const PlaceSchema = z.object({
    type: z.literal(ObjectType.PLACE),
    name: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    address: z.string().optional(),
})

// Public Key schema
export const PublicKeySchema = z.object({
    id: z.string().url(),
    owner: z.string().url(),
    publicKeyPem: z.string(),
})

// Person (Actor) schema
export const PersonSchema = z.object({
    '@context': z.union([z.string(), z.array(z.unknown())]).optional(),
    type: z.literal(ObjectType.PERSON),
    id: z.string().url(),
    preferredUsername: z.string(),
    name: z.string().optional(),
    summary: z.string().optional(),
    inbox: z.string().url(),
    outbox: z.string().url(),
    followers: z.string().url().optional(),
    following: z.string().url().optional(),
    publicKey: PublicKeySchema.optional(),
    icon: ImageSchema.optional(),
    image: ImageSchema.optional(),
    endpoints: z
        .object({
            sharedInbox: z.string().url().optional(),
        })
        .optional(),
    displayColor: z.string().optional(),
})

// Event schema
export const EventSchema = z.object({
    '@context': z.union([z.string(), z.array(z.unknown())]).optional(),
    type: z.literal(ObjectType.EVENT),
    id: z.string().url(),
    name: z.string(),
    summary: z.string().optional(),
    content: z.string().optional(),
    startTime: z.string().datetime(),
    endTime: z.string().datetime().optional(),
    duration: z.string().optional(),
    location: z.union([z.string(), PlaceSchema]).optional(),
    attachment: z.array(ImageSchema).optional(),
    attributedTo: z.string().url(),
    published: z.string().datetime().optional(),
    updated: z.string().datetime().optional(),
    url: z.string().url().optional(),
    eventStatus: z.nativeEnum(EventStatus).optional(),
    eventAttendanceMode: z.nativeEnum(EventAttendanceMode).optional(),
    maximumAttendeeCapacity: z.number().optional(),
    to: urlOrArray.optional(),
    cc: urlOrArray.optional(),
    bcc: urlOrArray.optional(),
})

// Note schema (for comments)
export const NoteSchema = z.object({
    '@context': z.union([z.string(), z.array(z.unknown())]).optional(),
    type: z.literal(ObjectType.NOTE),
    id: z.string().url(),
    content: z.string(),
    attributedTo: z.string().url(),
    inReplyTo: z.string().url().optional(),
    published: z.string().datetime().optional(),
    to: urlOrArray.optional(),
    cc: urlOrArray.optional(),
})

// Tombstone schema (for deletions)
export const TombstoneSchema = z.object({
    type: z.literal(ObjectType.TOMBSTONE),
    id: z.string().url(),
    formerType: z.string().optional(),
    deleted: z.string().datetime().optional(),
})

// Generic object schema


// Activity base schema
const BaseActivitySchema = z.object({
    '@context': z.union([z.string(), z.array(z.unknown())]).optional(),
    id: z.string().url(),
    type: z.string(),
    actor: z.string().url(),
    published: z.string().datetime().optional(),
    to: urlOrArray.optional(),
    cc: urlOrArray.optional(),
    bcc: urlOrArray.optional(),
})

// Create Activity
export const CreateActivitySchema = BaseActivitySchema.extend({
    type: z.literal(ActivityType.CREATE),
    object: z.union([EventSchema, NoteSchema, z.record(z.string(), z.unknown())]),
})

// Update Activity
export const UpdateActivitySchema = BaseActivitySchema.extend({
    type: z.literal(ActivityType.UPDATE),
    object: z.union([EventSchema, PersonSchema, z.record(z.string(), z.unknown())]),
})

// Delete Activity
export const DeleteActivitySchema = BaseActivitySchema.extend({
    type: z.literal(ActivityType.DELETE),
    object: z.union([z.string().url(), TombstoneSchema, z.record(z.string(), z.unknown())]),
})

// Follow Activity
export const FollowActivitySchema = BaseActivitySchema.extend({
    type: z.literal(ActivityType.FOLLOW),
    object: z.string().url(),
})

// Accept Activity
export const AcceptActivitySchema = BaseActivitySchema.extend({
    type: z.literal(ActivityType.ACCEPT),
    object: z.union([z.string().url(), FollowActivitySchema, z.record(z.string(), z.unknown())]),
})

// Reject Activity
export const RejectActivitySchema = BaseActivitySchema.extend({
    type: z.literal(ActivityType.REJECT),
    object: z.union([z.string().url(), z.record(z.string(), z.unknown())]),
})

// Like Activity
export const LikeActivitySchema = BaseActivitySchema.extend({
    type: z.literal(ActivityType.LIKE),
    object: z.string().url(),
})

// Undo Activity
export const UndoActivitySchema = BaseActivitySchema.extend({
    type: z.literal(ActivityType.UNDO),
    object: z.union([
        z.string().url(),
        z.object({
            id: z.string().url(),
            type: z.string(),
        }),
        z.record(z.string(), z.unknown()),
    ]),
})

// Announce Activity
export const AnnounceActivitySchema = BaseActivitySchema.extend({
    type: z.literal(ActivityType.ANNOUNCE),
    object: z.union([z.string().url(), z.record(z.string(), z.unknown())]),
})

// TentativeAccept Activity (for attendance)
export const TentativeAcceptActivitySchema = BaseActivitySchema.extend({
    type: z.literal(ActivityType.TENTATIVE_ACCEPT),
    object: z.string().url(),
})

// Block Activity
export const BlockActivitySchema = BaseActivitySchema.extend({
    type: z.literal(ActivityType.BLOCK),
    object: z.string().url(),
})

// Flag Activity (for reports)
export const FlagActivitySchema = BaseActivitySchema.extend({
    type: z.literal(ActivityType.FLAG),
    object: z.union([z.string().url(), z.array(z.string().url())]),
    content: z.string().optional(),
})

// Generic Activity schema
export const ActivitySchema = z.union([
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
    BaseActivitySchema,
])

// OrderedCollection schema
export const OrderedCollectionSchema = z.object({
    '@context': z.union([z.string(), z.array(z.unknown())]).optional(),
    type: z.literal(CollectionType.ORDERED_COLLECTION),
    id: z.string().url(),
    totalItems: z.number(),
    orderedItems: z.array(z.unknown()).optional(),
    first: z.string().url().optional(),
    last: z.string().url().optional(),
})

// OrderedCollectionPage schema
export const OrderedCollectionPageSchema = z.object({
    '@context': z.union([z.string(), z.array(z.unknown())]).optional(),
    type: z.literal(CollectionType.ORDERED_COLLECTION_PAGE),
    id: z.string().url(),
    partOf: z.string().url(),
    orderedItems: z.array(z.unknown()),
    next: z.string().url().optional(),
    prev: z.string().url().optional(),
})

// WebFinger schema
export const WebFingerSchema = z.object({
    subject: z.string(),
    aliases: z.array(z.string()).optional(),
    links: z.array(
        z.object({
            rel: z.string(),
            type: z.string().optional(),
            href: z.string().url().optional(),
        })
    ),
})

// Type exports
export type Person = z.infer<typeof PersonSchema>
export type Event = z.infer<typeof EventSchema>
export type Note = z.infer<typeof NoteSchema>
export type Activity = z.infer<typeof ActivitySchema>
export type CreateActivity = z.infer<typeof CreateActivitySchema>
export type UpdateActivity = z.infer<typeof UpdateActivitySchema>
export type DeleteActivity = z.infer<typeof DeleteActivitySchema>
export type FollowActivity = z.infer<typeof FollowActivitySchema>
export type AcceptActivity = z.infer<typeof AcceptActivitySchema>
export type RejectActivity = z.infer<typeof RejectActivitySchema>
export type LikeActivity = z.infer<typeof LikeActivitySchema>
export type UndoActivity = z.infer<typeof UndoActivitySchema>
export type AnnounceActivity = z.infer<typeof AnnounceActivitySchema>
export type TentativeAcceptActivity = z.infer<typeof TentativeAcceptActivitySchema>
export type BlockActivity = z.infer<typeof BlockActivitySchema>
export type FlagActivity = z.infer<typeof FlagActivitySchema>
export type OrderedCollection = z.infer<typeof OrderedCollectionSchema>
export type OrderedCollectionPage = z.infer<typeof OrderedCollectionPageSchema>
