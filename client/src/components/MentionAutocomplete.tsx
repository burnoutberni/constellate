import { Avatar, Button } from './ui'

export interface MentionSuggestion {
    id: string
    username: string
    name?: string | null
    profileImage?: string | null
    displayColor?: string | null
}

interface MentionAutocompleteProps {
    suggestions: MentionSuggestion[]
    activeIndex: number
    onSelect: (suggestion: MentionSuggestion) => void
    visible: boolean
}

export function MentionAutocomplete({
    suggestions,
    activeIndex,
    onSelect,
    visible,
}: MentionAutocompleteProps) {
    if (!visible || suggestions.length === 0) {
        return null
    }

    return (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-border-default bg-background-primary shadow-lg">
            {suggestions.map((suggestion, index) => {
                const isActive = index === activeIndex
                return (
                    <Button
                        type="button"
                        key={suggestion.id}
                        variant="ghost"
                        className={`flex w-full items-center gap-3 p-2 justify-start transition-colors hover:bg-primary-50 ${
                            isActive ? 'bg-primary-50' : 'bg-background-primary'
                        }`}
                        onMouseDown={(e) => {
                            e.preventDefault()
                            onSelect(suggestion)
                        }}
                    >
                        <Avatar
                            src={suggestion.profileImage || undefined}
                            alt={suggestion.name || suggestion.username}
                            fallback={suggestion.name?.[0] || suggestion.username[0]}
                            size="sm"
                        />
                        <div className="flex flex-col">
                            <span className="font-medium text-sm text-text-primary">
                                {suggestion.name || suggestion.username}
                            </span>
                            <span className="text-xs text-text-secondary">@{suggestion.username}</span>
                        </div>
                    </Button>
                )
            })}
        </div>
    )
}
