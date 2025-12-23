/**
 * Email Templates Index
 * Central exports for all email templates
 */

// Base components
export { BaseEmailTemplate, EmailButton, EmailCard } from './base.js'

// Authentication templates
export { PasswordResetEmailTemplate } from './auth.js'

// Notification templates
export { NotificationEmailTemplate, WeeklyDigestEmailTemplate } from './notifications.js'

// Template types
export type { BaseEmailProps, EmailButtonProps, EmailCardProps } from './base.js'

export type { PasswordResetEmailProps } from './auth.js'

export type { NotificationEmailProps, WeeklyDigestProps } from './notifications.js'
