/**
 * Theme Toggle Component
 *
 * Allows users to switch between light and dark themes.
 * Uses Tailwind utility classes with theme-aware semantic colors.
 *
 * FEATURES:
 * - Shows current theme (light/dark)
 * - Shows system preference when user hasn't made a choice
 * - Allows user to override system preference
 * - Uses proper accessibility labels
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useTheme } from '@/design-system'
import { queryKeys } from '@/hooks/queries'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api-client'
import { useUIStore } from '@/stores'

import { Button } from './ui'

export function ThemeToggle() {
    const { user } = useAuth()
    const { theme, systemPreference, userTheme } = useTheme()
    const queryClient = useQueryClient()
    const addToast = useUIStore((state) => state.addToast)

    const updateThemeMutation = useMutation({
        mutationFn: async (newTheme: 'LIGHT' | 'DARK') => {
            return api.put('/profile', { theme: newTheme }, undefined, 'Failed to update theme preference')
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.users.currentProfile(user?.id) })
        },
        onError: () => {
            addToast({
                id: 'theme-update-error',
                message: 'Failed to save your theme preference. Please try again.',
                variant: 'error',
            })
        },
    })

    const handleToggleTheme = () => {
        const newTheme = theme === 'LIGHT' ? 'DARK' : 'LIGHT'
        // Save to profile - the theme will update when the profile query invalidates
        updateThemeMutation.mutate(newTheme)
    }

    const getToggleLabel = () => {
        if (!userTheme) {
            return `Switch to ${theme === 'LIGHT' ? 'DARK' : 'LIGHT'} mode (current: ${theme}, system: ${systemPreference})`
        }
        return `Switch to ${theme === 'LIGHT' ? 'DARK' : 'LIGHT'} mode (your preference: ${theme})`
    }

    const getTitle = () => {
        if (!userTheme) {
            return `Current: ${theme} (following system: ${systemPreference}). Click to override.`
        }
        return `Current theme: ${theme} (your preference). Click to switch.`
    }

    return (
        <Button
            onClick={handleToggleTheme}
            variant="secondary"
            size="sm"
            aria-label={getToggleLabel()}
            title={getTitle()}>
            <span className="text-lg">{theme === 'LIGHT' ? '🌙' : '☀️'}</span>
            <span className="text-sm font-medium hidden sm:inline">
                {theme === 'LIGHT' ? 'Dark' : 'Light'}
            </span>
            {!userTheme && (
                <span className="text-xs text-text-tertiary hidden md:inline ml-1">
                    (Auto)
                </span>
            )}
        </Button>
    )
}
