/**
 * Base Email Template
 * Provides the main HTML structure with responsive design and branding
 */

export interface BaseEmailProps {
	/** Email subject */
	subject: string
	/** Preview text shown in email clients */
	previewText?: string
	/** Recipient's first name for personalization */
	userName?: string
	/** Main content of the email */
	children: string
	/** Footer content override */
	footerContent?: string
	/** Brand color for customization */
	brandColor?: string
}

export function BaseEmailTemplate({
	subject,
	previewText,
	userName = 'there',
	children,
	footerContent,
	brandColor = '#3b82f6',
}: BaseEmailProps) {
	const currentDate = new Date().toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	})

	// Add preview text as a hidden snippet for email clients
	const previewSnippet = previewText
		? `<div style="display:none;max-height:0;overflow:hidden;color:transparent;">${previewText}</div>`
		: ''

	return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${subject}</title>
    <style>
        /* Reset styles */
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
        body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }
        
        /* Prevent iOS auto-linking */
        [x-apple-data-detectors] {
            color: inherit !important;
            text-decoration: none !important;
            font-size: inherit !important;
            font-family: inherit !important;
            font-weight: inherit !important;
            line-height: inherit !important;
        }
        
        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
            .email-container {
                background-color: #1a1a1a !important;
            }
            .email-card {
                background-color: #2d2d2d !important;
                border-color: #404040 !important;
            }
            .email-text {
                color: #e5e5e5 !important;
            }
            .email-text-secondary {
                color: #a0a0a0 !important;
            }
        }
    </style>
</head>
<body style="margin: 0 !important; padding: 0 !important; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;">
    ${previewSnippet}
    <!--[if mso]-->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc;">
    <tr>
    <td>
    <![endif]-->
    
    <!-- Email container -->
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;" class="email-container">
        
        <!-- Header -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;" class="email-card">
            <tr>
                <td style="padding: 32px 32px 0; text-align: center;">
                    <!-- Logo/Brand -->
                    <div style="display: inline-block; padding: 12px 24px; background-color: ${brandColor}; border-radius: 8px; margin-bottom: 24px;">
                        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.025em;">
                            ⭐ Constellate
                        </h1>
                    </div>
                </td>
            </tr>
            
            <!-- Content -->
            <tr>
                <td style="padding: 0 32px 32px;">
                    <!-- Personalized greeting -->
                    <h2 style="margin: 0 0 16px; color: #1e293b; font-size: 20px; font-weight: 600;" class="email-text">
                        Hi ${userName},
                    </h2>
                    
                    <!-- Email content -->
                    <div style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 24px;" class="email-text-secondary">
                        ${children}
                    </div>
                </td>
            </tr>
            
            <!-- Footer -->
            <tr>
                <td style="background-color: #f8fafc; padding: 24px 32px; border-top: 1px solid #e2e8f0;">
                    <div style="color: #64748b; font-size: 14px; line-height: 1.5; text-align: center;" class="email-text-secondary">
                        ${
							footerContent ||
							`
                            <p style="margin: 0 0 8px;">This email was sent by Constellate on ${currentDate}</p>
                            <p style="margin: 0;">
                                <a href="{{{UNSUBSCRIBE_URL}}}" style="color: ${brandColor}; text-decoration: underline;">Unsubscribe</a> | 
                                <a href="{{{PREFERENCES_URL}}}" style="color: ${brandColor}; text-decoration: underline;">Email Preferences</a>
                            </p>
                        `
						}
                    </div>
                </td>
            </tr>
        </table>
        
        <!-- Spacer -->
        <div style="height: 20px;">&nbsp;</div>
        
        <!-- Small footer note -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
                <td style="text-align: center; color: #94a3b8; font-size: 12px; line-height: 1.4;">
                    <p style="margin: 0;">
                        Constellate - Connect through events<br>
                        Federated event management platform
                    </p>
                </td>
            </tr>
        </table>
    </div>
    
    <!--[if mso]-->
    </td>
    </tr>
    </table>
    <![endif]-->
</body>
</html>`
}

/**
 * Button component for email templates
 */
export interface EmailButtonProps {
	/** Button text */
	children: string
	/** Button URL */
	href: string
	/** Button variant */
	variant?: 'primary' | 'secondary'
	/** Full width on mobile */
	fullWidth?: boolean
}

export function EmailButton({
	children,
	href,
	variant = 'primary',
	fullWidth = false,
}: EmailButtonProps) {
	const backgroundColor = variant === 'primary' ? '#3b82f6' : '#ffffff'
	const textColor = variant === 'primary' ? '#ffffff' : '#3b82f6'
	const borderColor = variant === 'primary' ? '#3b82f6' : '#d1d5db'

	return `
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="${fullWidth ? 'width: 100%;' : 'display: inline-block;'}">
            <tr>
                <td style="background-color: ${backgroundColor}; border: 1px solid ${borderColor}; border-radius: 8px; padding: 12px 24px; text-align: center;">
                    <a href="${href}" style="color: ${textColor}; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block; ${fullWidth ? 'width: 100%;' : ''}" aria-label="${children}">
                        ${children}
                    </a>
                </td>
            </tr>
        </table>
    `
}

/**
 * Card component for email content sections
 */
export interface EmailCardProps {
	/** Card content */
	children: string
	/** Card title */
	title?: string
	/** Border color */
	borderColor?: string
}

export function EmailCard({ children, title, borderColor = '#e2e8f0' }: EmailCardProps) {
	return `
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border: 1px solid ${borderColor}; border-radius: 8px; margin: 16px 0;">
            ${
				title
					? `
            <tr>
                <td style="background-color: #f8fafc; padding: 16px 20px; border-bottom: 1px solid ${borderColor};">
                    <h3 style="margin: 0; color: #1e293b; font-size: 18px; font-weight: 600;">${title}</h3>
                </td>
            </tr>
            `
					: ''
			}
            <tr>
                <td style="padding: 20px; color: #475569; font-size: 16px; line-height: 1.6;">
                    ${children}
                </td>
            </tr>
        </table>
    `
}
