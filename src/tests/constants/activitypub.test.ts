import { describe, it, expect } from 'vitest'
import {
	ACTIVITYSTREAMS_CONTEXT,
	W3ID_SECURITY_CONTEXT,
	ACTIVITYPUB_CONTEXTS,
	PUBLIC_COLLECTION,
	ActivityType,
	ObjectType,
	CollectionType,
	EventStatus,
	EventAttendanceMode,
	AttendanceStatus,
	ContentType,
	PAGINATION,
} from '../../constants/activitypub.js'

describe('ActivityPub Constants', () => {
	describe('Context URLs', () => {
		it('should have correct ActivityStreams context URL', () => {
			expect(ACTIVITYSTREAMS_CONTEXT).toBe('https://www.w3.org/ns/activitystreams')
		})

		it('should have correct W3ID security context URL', () => {
			expect(W3ID_SECURITY_CONTEXT).toBe('https://w3id.org/security/v1')
		})

		it('should have both contexts in ACTIVITYPUB_CONTEXTS array', () => {
			expect(ACTIVITYPUB_CONTEXTS).toContain(ACTIVITYSTREAMS_CONTEXT)
			expect(ACTIVITYPUB_CONTEXTS).toContain(W3ID_SECURITY_CONTEXT)
			expect(ACTIVITYPUB_CONTEXTS).toHaveLength(2)
		})
	})

	describe('Public Collection', () => {
		it('should have correct public collection URL', () => {
			expect(PUBLIC_COLLECTION).toBe('https://www.w3.org/ns/activitystreams#Public')
		})
	})

	describe('ActivityType', () => {
		it('should have all required activity types', () => {
			expect(ActivityType.CREATE).toBe('Create')
			expect(ActivityType.UPDATE).toBe('Update')
			expect(ActivityType.DELETE).toBe('Delete')
			expect(ActivityType.FOLLOW).toBe('Follow')
			expect(ActivityType.ACCEPT).toBe('Accept')
			expect(ActivityType.REJECT).toBe('Reject')
			expect(ActivityType.LIKE).toBe('Like')
			expect(ActivityType.UNDO).toBe('Undo')
			expect(ActivityType.ANNOUNCE).toBe('Announce')
			expect(ActivityType.TENTATIVE_ACCEPT).toBe('TentativeAccept')
			expect(ActivityType.BLOCK).toBe('Block')
			expect(ActivityType.FLAG).toBe('Flag')
			expect(ActivityType.ADD).toBe('Add')
			expect(ActivityType.REMOVE).toBe('Remove')
		})
	})

	describe('ObjectType', () => {
		it('should have all required object types', () => {
			expect(ObjectType.PERSON).toBe('Person')
			expect(ObjectType.GROUP).toBe('Group')
			expect(ObjectType.EVENT).toBe('Event')
			expect(ObjectType.NOTE).toBe('Note')
			expect(ObjectType.PLACE).toBe('Place')
			expect(ObjectType.IMAGE).toBe('Image')
			expect(ObjectType.DOCUMENT).toBe('Document')
			expect(ObjectType.TOMBSTONE).toBe('Tombstone')
		})
	})

	describe('CollectionType', () => {
		it('should have all required collection types', () => {
			expect(CollectionType.COLLECTION).toBe('Collection')
			expect(CollectionType.ORDERED_COLLECTION).toBe('OrderedCollection')
			expect(CollectionType.COLLECTION_PAGE).toBe('CollectionPage')
			expect(CollectionType.ORDERED_COLLECTION_PAGE).toBe('OrderedCollectionPage')
		})
	})

	describe('EventStatus', () => {
		it('should have all required event status values', () => {
			expect(EventStatus.SCHEDULED).toBe('EventScheduled')
			expect(EventStatus.CANCELLED).toBe('EventCancelled')
			expect(EventStatus.POSTPONED).toBe('EventPostponed')
		})
	})

	describe('EventAttendanceMode', () => {
		it('should have all required attendance mode values', () => {
			expect(EventAttendanceMode.OFFLINE).toBe('OfflineEventAttendanceMode')
			expect(EventAttendanceMode.ONLINE).toBe('OnlineEventAttendanceMode')
			expect(EventAttendanceMode.MIXED).toBe('MixedEventAttendanceMode')
		})
	})

	describe('AttendanceStatus', () => {
		it('should have all required attendance status values', () => {
			expect(AttendanceStatus.ATTENDING).toBe('attending')
			expect(AttendanceStatus.MAYBE).toBe('maybe')
			expect(AttendanceStatus.NOT_ATTENDING).toBe('not_attending')
		})
	})

	describe('ContentType', () => {
		it('should have all required content type values', () => {
			expect(ContentType.ACTIVITY_JSON).toBe('application/activity+json')
			expect(ContentType.LD_JSON).toBe(
				'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
			)
			expect(ContentType.JSON).toBe('application/json')
		})
	})

	describe('Pagination', () => {
		it('should have correct pagination defaults', () => {
			expect(PAGINATION.DEFAULT_PAGE_SIZE).toBe(20)
			expect(PAGINATION.MAX_PAGE_SIZE).toBe(100)
		})
	})
})
