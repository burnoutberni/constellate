import { memo } from 'react'
import { z } from 'zod'

import { EventCard } from '@/components/EventCard'
import { OnboardingHero } from '@/components/Feed/OnboardingHero'
import { SuggestedUsersCard } from '@/components/Feed/SuggestedUsersCard'
import { type FeedItem } from '@/hooks/queries'
import { logger } from '@/lib/logger'
import {
	HeaderSchema,
	SuggestedUsersSchema,
	EventSchema,
	ActivitySchema
} from '@/types'

// Validation helper
function getValidatedData<T extends z.ZodTypeAny>(
	schema: T,
	data: unknown,
	context: string
): z.infer<T> | null {
	const result = schema.safeParse(data)
	if (!result.success) {
		logger.error(`FeedItemRenderer: Invalid ${context} data`, result.error)
		return null
	}
	return result.data
}

interface FeedItemRendererProps {
	item: FeedItem
	isAuthenticated: boolean
}

// Memoized renderer to prevent re-validation and re-rendering of stable items
export const FeedItemRenderer = memo(({ item, isAuthenticated }: FeedItemRendererProps) => {
	switch (item.type) {
		case 'header': {
			const validated = getValidatedData(HeaderSchema, item.data, 'header')
			if (validated) {
				const { title } = validated
				return (
					<div className="pt-4 pb-2">
						<h2 className="text-lg font-semibold text-text-primary border-b border-border-default pb-2">
							{title}
						</h2>
					</div>
				)
			}
			return null
		}

		case 'onboarding': {
			const validated = getValidatedData(SuggestedUsersSchema, item.data, 'onboarding')
			if (validated) {
				return <OnboardingHero suggestions={validated.suggestions} />
			}
			return null
		}

		case 'suggested_users': {
			const validated = getValidatedData(SuggestedUsersSchema, item.data, 'suggested_users')
			if (validated) {
				return <SuggestedUsersCard users={validated.suggestions} />
			}
			return null
		}

		case 'trending_event': {
			const validated = getValidatedData(EventSchema, item.data, 'trending_event')
			if (validated) {
				return (
					<div className="h-full">
						<EventCard event={validated} isAuthenticated={isAuthenticated} />
					</div>
				)
			}
			return null
		}

		case 'activity': {
			const validated = getValidatedData(ActivitySchema, item.data, 'activity')
			if (validated) {
				// For "Smart Agenda", we show the Event itself
				return (
					<div className="h-full">
						{validated.event && <EventCard event={validated.event} isAuthenticated={isAuthenticated} />}
					</div>
				)
			}
			return null
		}

		default:
			return null
	}
})

FeedItemRenderer.displayName = 'FeedItemRenderer'
