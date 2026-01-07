
import { Card } from '@/components/ui'
import type { SuggestedUser } from '@/types'

import { SuggestedUsersCard } from './SuggestedUsersCard'

interface OnboardingHeroProps {
    suggestions: SuggestedUser[]
}

export function OnboardingHero({ suggestions }: OnboardingHeroProps) {
    return (
        <div className="mb-6 space-y-4">
            <Card variant="elevated" padding="lg" className="border-primary-500/20 bg-gradient-to-r from-primary-50 to-transparent dark:from-primary-950/30">
                <h1 className="text-2xl font-bold text-text-primary mb-2">Welcome to Constellate! </h1>
                <p className="text-text-secondary mb-4">
                    Your feed is a bit quiet right now. Follow people to see their events and activities here.
                </p>
                {/* We can add quick actions here later like "Find contacts" or "Edit profile" */}
            </Card>

            {suggestions.length > 0 && <SuggestedUsersCard users={suggestions} />}
        </div>
    )
}
