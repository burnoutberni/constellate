/**
 * Magic Link Email Template
 * Used for authentication via magic links
 */

import { BaseEmailTemplate, EmailButton } from './base.js'

export interface MagicLinkEmailProps {
    /** Recipient's display name */
    userName?: string
    /** The magic link URL */
    loginUrl: string
    /** Expiration time in minutes */
    expiresInMinutes?: number
    /** Whether this is for a new user signup */
    isSignup?: boolean
}

export function MagicLinkEmailTemplate({
    userName,
    loginUrl,
    expiresInMinutes = 15,
    isSignup = false,
}: MagicLinkEmailProps) {
    const subject = isSignup ? 'Welcome to Constellate!' : 'Login to Constellate'
    const previewText = isSignup
        ? 'Get started with your new Constellate account'
        : 'Use this magic link to sign in to your account'

    const content = `
        ${
            isSignup
                ? `
            <p>Welcome to Constellate! We're excited to have you join our federated event management platform.</p>
            <p>Your account has been created successfully. To complete your signup and get started, just click the button below:</p>
        `
                : `
            <p>You requested a magic link to sign in to your Constellate account. No password needed!</p>
            <p>Simply click the button below to securely access your account:</p>
        `
        }
        
        <div style="text-align: center; margin: 32px 0;">
            ${EmailButton({
                children: isSignup ? 'Complete Sign Up' : 'Sign In to Constellate',
                href: loginUrl,
                variant: 'primary',
                fullWidth: true,
            })}
        </div>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 16px 0;">
            <p style="margin: 0 0 8px; color: #1e293b; font-size: 16px; font-weight: 600;">Important Information</p>
            <p style="margin: 0 0 4px; color: #475569; font-size: 14px; line-height: 1.6;">
                <strong>Security:</strong> This link is unique to you and can only be used once.
            </p>
            <p style="margin: 0 0 4px; color: #475569; font-size: 14px; line-height: 1.6;">
                <strong>Expiration:</strong> This link will expire in ${expiresInMinutes} minutes for your security.
            </p>
            <p style="margin: 0 0 4px; color: #475569; font-size: 14px; line-height: 1.6;">
                <strong>Safe browsing:</strong> Always verify you're on constellate.[your-domain] before entering any information.
            </p>
        </div>
        
        <p>If you didn't ${isSignup ? 'create an account' : 'request this sign-in link'}, you can safely ignore this email. The link will expire automatically.</p>
        
        ${
            isSignup
                ? `
            <p>Ready to get started? Constellate helps you discover, create, and manage events while connecting with others across the federated web.</p>
        `
                : ''
        }
    `

    return BaseEmailTemplate({
        subject,
        previewText,
        userName,
        children: content,
    })
}

/**
 * Password Reset Email Template (for future use)
 */
export interface PasswordResetEmailProps {
    userName?: string
    resetUrl: string
    expiresInMinutes?: number
}

export function PasswordResetEmailTemplate({
    userName,
    resetUrl,
    expiresInMinutes = 30,
}: PasswordResetEmailProps) {
    const subject = 'Reset your Constellate password'
    const previewText = 'Securely reset your account password'

    const content = `
        <p>You requested to reset your Constellate password. Click the button below to create a new password:</p>
        
        <div style="text-align: center; margin: 32px 0;">
            ${EmailButton({
                children: 'Reset Password',
                href: resetUrl,
                variant: 'primary',
                fullWidth: true,
            })}
        </div>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 16px 0;">
            <p style="margin: 0 0 8px; color: #1e293b; font-size: 16px; font-weight: 600;">Security Notice</p>
            <p style="margin: 0 0 4px; color: #475569; font-size: 14px; line-height: 1.6;">
                <strong>Expiration:</strong> This link will expire in ${expiresInMinutes} minutes.
            </p>
            <p style="margin: 0 0 4px; color: #475569; font-size: 14px; line-height: 1.6;">
                <strong>Single use:</strong> The link can only be used once.
            </p>
            <p style="margin: 0 0 4px; color: #475569; font-size: 14px; line-height: 1.6;">
                <strong>Security:</strong> If you didn't request this reset, please secure your account immediately.
            </p>
        </div>
        
        <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns about your account security.</p>
    `

    return BaseEmailTemplate({
        subject,
        previewText,
        userName,
        children: content,
    })
}
