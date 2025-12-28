/**
 * ActivityPub Zod Schemas
 * Type-safe validation for ActivityPub objects and activities
 */

import { z } from '@hono/zod-openapi'
import { ActivityType, ObjectType, CollectionType } from '../constants/activitypub.js'

// Base schemas
const urlOrArray = z.union([
	z.string().regex(/^https?:\/\//, { message: 'Invalid URL' }),
	z.array(z.string().regex(/^https?:\/\//, { message: 'Invalid URL' })),
])

// Image schema
export const ImageSchema = z.object({
	type: z.literal(ObjectType.IMAGE),
	url: z.string().regex(/^https?:\/\//, { message: 'Invalid URL' }),
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
	id: z.string().regex(/^https?:\/\//, { message: 'Invalid URL' }),
	owner: z.string().regex(/^https?:\/\//, { message: 'Invalid URL' }),
	publicKeyPem: z.string(),
})

// Person (Actor) schema
export const PersonSchema = z.object({
	'@context': z.union([z.string(), z.array(z.unknown())]).optional(),
	type: z.literal(ObjectType.PERSON),
	id: z.string().regex(/^https?:\/\//, { message: 'Invalid URL' }),
	preferredUsername: z.string(),
	name: z.string().optional(),
	summary: z.string().optional(),
	inbox: z.string().regex(/^https?:\/\//, { message: 'Invalid URL' }),
	outbox: z.string().regex(/^https?:\/\//, { message: 'Invalid URL' }),
	followers: z
		.string()
		.regex(/^https?:\/\//, { message: 'Invalid URL' })
		.optional(),
	following: z
		.string()
		.regex(/^https?:\/\//, { message: 'Invalid URL' })
		.optional(),
	publicKey: PublicKeySchema.optional(),
	icon: ImageSchema.optional(),
	image: ImageSchema.optional(),
	endpoints: z
		.object({
			sharedInbox: z
				.string()
				.regex(/^https?:\/\//, { message: 'Invalid URL' })
				.optional(),
		})
		.optional(),
	displayColor: z.string().optional(),
})

// Event schema
export const EventSchema = z.object({
	'@context': z.union([z.string(), z.array(z.unknown())]).optional(),
	type: z.literal(ObjectType.EVENT),
	id: z.string().regex(/^https?:\/\//, { message: 'Invalid URL' }),
	name: z.string(),
	summary: z.string().optional(),
	content: z.string().optional(),
	startTime: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/, {
			message: 'Invalid datetime string',
		}),
	endTime: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/, {
			message: 'Invalid datetime string',
		})
		.optional(),
	duration: z.string().optional(),
	location: z.union([z.string(), PlaceSchema]).optional(),
	attachment: z.array(ImageSchema).optional(),
	attributedTo: z.string().regex(/^https?:\/\//, { message: 'Invalid URL' }),
	published: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/, {
			message: 'Invalid datetime string',
		})
		.optional(),
	updated: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/, {
			message: 'Invalid datetime string',
		})
		.optional(),
	url: z
		.string()
		.regex(/^https?:\/\//, { message: 'Invalid URL' })
		.optional(),
	eventStatus: z.enum(['EventScheduled', 'EventCancelled', 'EventPostponed']).optional(),
	eventAttendanceMode: z
		.enum([
			'OfflineEventAttendanceMode',
			'OnlineEventAttendanceMode',
			'MixedEventAttendanceMode',
		])
		.optional(),
	maximumAttendeeCapacity: z.number().optional(),
	to: urlOrArray.optional(),
	cc: urlOrArray.optional(),
	bcc: urlOrArray.optional(),
})

// Note schema (for comments)
export const NoteSchema = z.object({
	'@context': z.union([z.string(), z.array(z.unknown())]).optional(),
	type: z.literal(ObjectType.NOTE),
	id: z.string().regex(/^https?:\/\//, { message: 'Invalid URL' }),
	content: z.string(),
	attributedTo: z.string().regex(/^https?:\/\//, { message: 'Invalid URL' }),
	inReplyTo: z
		.string()
		.regex(/^https?:\/\//, { message: 'Invalid URL' })
		.optional(),
	published: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/, {
			message: 'Invalid datetime string',
		})
		.optional(),
	to: urlOrArray.optional(),
	cc: urlOrArray.optional(),
})

// Tombstone schema (for deletions)
export const TombstoneSchema = z.object({
	type: z.literal(ObjectType.TOMBSTONE),
	id: z.string().regex(/^https?:\/\//, { message: 'Invalid URL' }),
	formerType: z.string().optional(),
	deleted: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/, {
			message: 'Invalid datetime string',
		})
		.optional(),
})

// Generic object schema

// Activity base schema
const BaseActivitySchema = z.object({
	'@context': z.union([z.string(), z.array(z.unknown())]).optional(),
	id: z.string().regex(/^https?:\/\//, { message: 'Invalid URL' }),
	type: z.string(),
	actor: z.string().regex(/^https?:\/\//, { message: 'Invalid URL' }),
	published: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/, {
			message: 'Invalid datetime string',
		})
		.optional(),
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
	object: z.union([
		z.string().regex(/^https?:\/\//, { message: 'Invalid URL' }),
		TombstoneSchema,
		z.record(z.string(), z.unknown()),
	]),
})

// Follow Activity
export const FollowActivitySchema = BaseActivitySchema.extend({
	type: z.literal(ActivityType.FOLLOW),
	object: z.string().regex(/^https?:\/\//, { message: 'Invalid URL' }),
})

// Accept Activity
export const AcceptActivitySchema = BaseActivitySchema.extend({
	type: z.literal(ActivityType.ACCEPT),
	object: z.union([
		z.string().regex(/^https?:\/\//, { message: 'Invalid URL' }),
		FollowActivitySchema,
		z.record(z.string(), z.unknown()),
	]),
})

// Reject Activity
export const RejectActivitySchema = BaseActivitySchema.extend({
	type: z.literal(ActivityType.REJECT),
	object: z.union([
		z.string().regex(/^https?:\/\//, { message: 'Invalid URL' }),
		z.record(z.string(), z.unknown()),
	]),
})

// Like Activity
export const LikeActivitySchema = BaseActivitySchema.extend({
	type: z.literal(ActivityType.LIKE),
	object: z.string().regex(/^https?:\/\//, { message: 'Invalid URL' }),
})

// Undo Activity
export const UndoActivitySchema = BaseActivitySchema.extend({
	type: z.literal(ActivityType.UNDO),
	object: z.union([
		z.string().regex(/^https?:\/\//, { message: 'Invalid URL' }),
		z.object({
			id: z.string().regex(/^https?:\/\//, { message: 'Invalid URL' }),
			type: z.string(),
		}),
		z.record(z.string(), z.unknown()),
	]),
})

// Announce Activity
export const AnnounceActivitySchema = BaseActivitySchema.extend({
	type: z.literal(ActivityType.ANNOUNCE),
	object: z.union([
		z.string().regex(/^https?:\/\//, { message: 'Invalid URL' }),
		z.record(z.string(), z.unknown()),
	]),
})

// TentativeAccept Activity (for attendance)
export const TentativeAcceptActivitySchema = BaseActivitySchema.extend({
	type: z.literal(ActivityType.TENTATIVE_ACCEPT),
	object: z.string().regex(/^https?:\/\//, { message: 'Invalid URL' }),
})

// Block Activity
export const BlockActivitySchema = BaseActivitySchema.extend({
	type: z.literal(ActivityType.BLOCK),
	object: z.string().regex(/^https?:\/\//, { message: 'Invalid URL' }),
})

// Flag Activity (for reports)
export const FlagActivitySchema = BaseActivitySchema.extend({
	type: z.literal(ActivityType.FLAG),
	object: z.union([
		z.string().regex(/^https?:\/\//, { message: 'Invalid URL' }),
		z.array(z.string().regex(/^https?:\/\//, { message: 'Invalid URL' })),
	]),
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
	id: z.string().regex(/^https?:\/\//, { message: 'Invalid URL' }),
	totalItems: z.number(),
	orderedItems: z.array(z.unknown()).optional(),
	first: z
		.string()
		.regex(/^https?:\/\//, { message: 'Invalid URL' })
		.optional(),
	last: z
		.string()
		.regex(/^https?:\/\//, { message: 'Invalid URL' })
		.optional(),
})

// OrderedCollectionPage schema
export const OrderedCollectionPageSchema = z.object({
	'@context': z.union([z.string(), z.array(z.unknown())]).optional(),
	type: z.literal(CollectionType.ORDERED_COLLECTION_PAGE),
	id: z.string().regex(/^https?:\/\//, { message: 'Invalid URL' }),
	partOf: z.string().regex(/^https?:\/\//, { message: 'Invalid URL' }),
	orderedItems: z.array(z.unknown()),
	next: z
		.string()
		.regex(/^https?:\/\//, { message: 'Invalid URL' })
		.optional(),
	prev: z
		.string()
		.regex(/^https?:\/\//, { message: 'Invalid URL' })
		.optional(),
})

// WebFinger schema
export const WebFingerSchema = z.object({
	subject: z.string(),
	aliases: z.array(z.string()).optional(),
	links: z.array(
		z.object({
			rel: z.string(),
			type: z.string().optional(),
			href: z
				.string()
				.regex(/^https?:\/\//, { message: 'Invalid URL' })
				.optional(),
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
