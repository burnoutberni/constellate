import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card'
import { Input } from './ui/Input'
import { Textarea } from './ui/Textarea'
import { Button } from './ui/Button'
import { Avatar } from './ui/Avatar'
import { queryKeys } from '../hooks/queries/keys'

interface ProfileSettingsProps {
  profile: {
    id: string
    username: string
    name: string | null
    bio: string | null
    profileImage: string | null
    headerImage: string | null
    displayColor: string
  }
  userId?: string
}

export function ProfileSettings({ profile, userId }: ProfileSettingsProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(profile.name || '')
  const [bio, setBio] = useState(profile.bio || '')
  const [profileImageUrl, setProfileImageUrl] = useState(profile.profileImage || '')
  const [headerImageUrl, setHeaderImageUrl] = useState(profile.headerImage || '')
  const [displayColor, setDisplayColor] = useState(profile.displayColor || '#3b82f6')

  // Update local state when profile changes
  useEffect(() => {
    setName(profile.name || '')
    setBio(profile.bio || '')
    setProfileImageUrl(profile.profileImage || '')
    setHeaderImageUrl(profile.headerImage || '')
    setDisplayColor(profile.displayColor || '#3b82f6')
  }, [profile])

  const updateProfileMutation = useMutation({
    mutationFn: async (data: {
      name?: string
      bio?: string
      profileImage?: string
      headerImage?: string
      displayColor?: string
    }) => {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        throw new Error('Failed to update profile')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.currentProfile(userId) })
    },
  })

  const handleSave = async () => {
    try {
      await updateProfileMutation.mutateAsync({
        name: name.trim() || undefined,
        bio: bio.trim() || undefined,
        profileImage: profileImageUrl.trim() || undefined,
        headerImage: headerImageUrl.trim() || undefined,
        displayColor,
      })
      alert('Profile updated successfully!')
    } catch (error) {
      console.error('Failed to update profile:', error)
      alert('Failed to update profile. Please try again.')
    }
  }

  const hasChanges =
    name !== (profile.name || '') ||
    bio !== (profile.bio || '') ||
    profileImageUrl !== (profile.profileImage || '') ||
    headerImageUrl !== (profile.headerImage || '') ||
    displayColor !== profile.displayColor

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Profile Preview */}
          <div className="flex items-center gap-4 p-4 bg-background-secondary rounded-lg">
            <Avatar
              src={profileImageUrl || undefined}
              alt={name || profile.username}
              size="lg"
              fallback={name || profile.username}
            />
            <div className="flex-1">
              <p className="font-semibold text-text-primary">
                {name || profile.username}
              </p>
              <p className="text-sm text-text-tertiary">@{profile.username}</p>
            </div>
            <div
              className="w-12 h-12 rounded-full"
              style={{ backgroundColor: displayColor }}
              title="Calendar color"
            />
          </div>

          {/* Display Name */}
          <Input
            label="Display Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your display name"
            maxLength={100}
            helperText="This is how your name will appear on the platform"
          />

          {/* Bio */}
          <Textarea
            label="Bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell others about yourself"
            maxLength={500}
            helperText={`${bio.length}/500 characters`}
            rows={4}
          />

          {/* Profile Image URL */}
          <Input
            label="Profile Image URL"
            type="url"
            value={profileImageUrl}
            onChange={(e) => setProfileImageUrl(e.target.value)}
            placeholder="https://example.com/avatar.jpg"
            helperText="Enter a URL for your profile picture"
          />

          {/* Header Image URL */}
          <Input
            label="Header Image URL"
            type="url"
            value={headerImageUrl}
            onChange={(e) => setHeaderImageUrl(e.target.value)}
            placeholder="https://example.com/header.jpg"
            helperText="Enter a URL for your profile header banner"
          />

          {/* Display Color */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-text-secondary">
              Calendar Color
            </label>
            <p className="text-sm text-text-tertiary mb-2">
              This color will be used for your events in calendar views
            </p>
            <div className="flex items-center gap-4">
              <input
                type="color"
                value={displayColor}
                onChange={(e) => setDisplayColor(e.target.value)}
                className="h-10 w-20 rounded border border-border-default cursor-pointer"
              />
              <Input
                type="text"
                value={displayColor}
                onChange={(e) => setDisplayColor(e.target.value)}
                placeholder="#3b82f6"
                pattern="^#[0-9A-Fa-f]{6}$"
                className="flex-1"
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={!hasChanges || updateProfileMutation.isPending}
              loading={updateProfileMutation.isPending}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
