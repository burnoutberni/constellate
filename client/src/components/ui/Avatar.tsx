import React from 'react'
import { cn } from '../../lib/utils'

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Source URL of the avatar image
   */
  src?: string
  /**
   * Alt text for the avatar image
   */
  alt?: string
  /**
   * Fallback text to display when image is not available (usually initials)
   */
  fallback?: string
  /**
   * Size of the avatar
   * @default 'md'
   */
  size?: AvatarSize
  /**
   * Whether the avatar should be rounded (circular)
   * @default true
   */
  rounded?: boolean
  /**
   * Whether to show a border around the avatar
   */
  bordered?: boolean
  /**
   * Status indicator (online, offline, away, etc.)
   */
  status?: 'online' | 'offline' | 'away' | 'busy'
}

/**
 * Avatar component for displaying user profile pictures or initials.
 * Fully accessible and supports dark mode.
 */
export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  (
    {
      src,
      alt,
      fallback,
      size = 'md',
      rounded = true,
      bordered = false,
      status,
      className,
      ...props
    },
    ref
  ) => {
    const [imageError, setImageError] = React.useState(false)
    const showImage = src && !imageError

    // Size styles
    const sizeStyles = {
      xs: 'w-6 h-6 text-xs',
      sm: 'w-8 h-8 text-sm',
      md: 'w-10 h-10 text-base',
      lg: 'w-12 h-12 text-lg',
      xl: 'w-16 h-16 text-xl',
    }

    // Status indicator sizes
    const statusSizeStyles = {
      xs: 'w-1.5 h-1.5',
      sm: 'w-2 h-2',
      md: 'w-2.5 h-2.5',
      lg: 'w-3 h-3',
      xl: 'w-3.5 h-3.5',
    }

    // Status colors
    const statusColors = {
      online: 'bg-success-500',
      offline: 'bg-neutral-400',
      away: 'bg-warning-500',
      busy: 'bg-error-500',
    }

    const avatarClasses = cn(
      'relative inline-flex items-center justify-center',
      'font-medium',
      'bg-background-secondary',
      'text-text-tertiary',
      'overflow-hidden',
      'flex-shrink-0',
      sizeStyles[size],
      rounded ? 'rounded-full' : 'rounded-lg',
      bordered && 'ring-2 ring-border-default',
      className
    )

    const handleImageError = () => {
      setImageError(true)
    }

    // Generate accessible label - prefer alt, then generic
    const accessibleLabel = alt || 'Avatar'

    return (
      <div
        ref={ref}
        className={avatarClasses}
        role="img"
        aria-label={accessibleLabel}
        {...props}
      >
        {showImage ? (
          <img
            src={src}
            alt=""
            className={cn(
              'w-full h-full object-cover',
              rounded ? 'rounded-full' : 'rounded-lg'
            )}
            onError={handleImageError}
            aria-hidden="true"
          />
        ) : (
          <span
            className={cn(
              'flex items-center justify-center w-full h-full',
              'font-semibold',
              rounded ? 'rounded-full' : 'rounded-lg'
            )}
            aria-hidden="true"
          >
            {fallback || '?'}
          </span>
        )}
        {status && (
          <span
            className={cn(
              'absolute bottom-0 right-0',
              'rounded-full border-2 border-background-primary',
              statusSizeStyles[size],
              statusColors[status]
            )}
            aria-label={`Status: ${status}`}
          />
        )}
      </div>
    )
  }
)

Avatar.displayName = 'Avatar'

/**
 * Avatar Group component for displaying multiple avatars together
 */
export interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Maximum number of avatars to show before collapsing
   */
  max?: number
  /**
   * Size of avatars in the group
   */
  size?: AvatarSize
  /**
   * Array of avatar data
   */
  avatars: Array<{
    src?: string
    alt?: string
    fallback?: string
  }>
}

export const AvatarGroup = React.forwardRef<HTMLDivElement, AvatarGroupProps>(
  ({ max = 3, size = 'md', avatars, className, ...props }, ref) => {
    const visibleAvatars = avatars.slice(0, max)
    const remainingCount = avatars.length - max

    return (
      <div
        ref={ref}
        className={cn('flex items-center -space-x-2', className)}
        {...props}
      >
        {visibleAvatars.map((avatar, index) => (
          <Avatar
            key={index}
            src={avatar.src}
            alt={avatar.alt}
            fallback={avatar.fallback}
            size={size}
            className="ring-2 ring-background-primary"
          />
        ))}
        {remainingCount > 0 && (
          <div
            className={cn(
              'flex items-center justify-center',
              'bg-background-secondary',
              'text-text-tertiary',
              'font-medium rounded-full',
              'ring-2 ring-background-primary',
              size === 'xs' && 'w-6 h-6 text-xs',
              size === 'sm' && 'w-8 h-8 text-sm',
              size === 'md' && 'w-10 h-10 text-base',
              size === 'lg' && 'w-12 h-12 text-lg',
              size === 'xl' && 'w-16 h-16 text-xl'
            )}
            aria-label={`${remainingCount} more avatars`}
          >
            +{remainingCount}
          </div>
        )}
      </div>
    )
  }
)

AvatarGroup.displayName = 'AvatarGroup'

