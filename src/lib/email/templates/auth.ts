/**
 * Password Reset Email Template (for future use)
 */

import { BaseEmailTemplate, EmailButton } from './base.js'

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
