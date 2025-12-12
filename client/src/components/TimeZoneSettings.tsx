import { useState, useEffect, useMemo, type ChangeEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from './ui'
import { Stack } from './layout'
import { queryKeys } from '@/hooks/queries'
import { getDefaultTimezone, getSupportedTimezones } from '../lib/timezones'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import { extractErrorMessage } from '@/lib/errorHandling'
import { api } from '@/lib/api-client'

interface TimeZoneSettingsProps {
  profile: {
    timezone: string
  }
  userId?: string
}

export function TimeZoneSettings({ profile, userId }: TimeZoneSettingsProps) {
  const queryClient = useQueryClient()
  const handleError = useErrorHandler()
  const timezoneOptions = useMemo(() => getSupportedTimezones(), [])
  const [timezone, setTimezone] = useState(profile.timezone || getDefaultTimezone())

  // Update local state when profile changes
  useEffect(() => {
    setTimezone(profile.timezone || getDefaultTimezone())
  }, [profile.timezone])

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { timezone?: string }) => {
      return api.put('/profile', data, undefined, 'Failed to update timezone')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.currentProfile(userId) })
    },
  })

  const handleTimezoneChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    const nextTimezone = event.target.value
    const previous = timezone
    setTimezone(nextTimezone)
    try {
      await updateProfileMutation.mutateAsync({ timezone: nextTimezone })
    } catch (error) {
      setTimezone(previous)
      const errorMessage = extractErrorMessage(error, 'Failed to update timezone preference. Please try again.')
      handleError(error, errorMessage, { context: 'TimeZoneSettings.handleTimezoneChange' })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Time & Region</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Stack gap="sm">
            <label className="font-medium text-text-primary" htmlFor="timezone-select">
              Preferred timezone
            </label>
            <p className="text-sm text-text-tertiary">
              Constellate will display event times using this timezone on supported pages.
            </p>
            <select
              id="timezone-select"
              className="block w-full px-4 py-2 border border-border-default rounded-lg bg-background-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-border-focus focus:border-border-focus transition-all duration-200"
              value={timezone}
              onChange={handleTimezoneChange}
              disabled={updateProfileMutation.isPending}
            >
              {timezoneOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <p className="text-sm text-text-tertiary">
              Times currently shown in <span className="font-semibold">{timezone}</span>.
            </p>
          </Stack>
        </div>
      </CardContent>
    </Card>
  )
}
