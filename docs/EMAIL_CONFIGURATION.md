# Email Configuration Guide

This guide covers setting up email functionality for Constellate, including SMTP configuration, email templates, and notification preferences.

## Overview

Constellate supports sending emails for:

- Magic link authentication
- Email notifications for user activity
- System notifications and alerts
- Password reset (future feature)

## SMTP Configuration

### Required Environment Variables

Add these to your `.env` file or Docker environment:

```bash
# SMTP Server Configuration
SMTP_HOST=smtp.gmail.com              # Your SMTP server hostname
SMTP_PORT=587                         # SMTP port (usually 587 for TLS)
SMTP_SECURE=false                       # Use SSL/TLS (false for TLS/STARTTLS, true for SSL)
SMTP_USER=your-email@gmail.com          # SMTP username (usually your email)
SMTP_PASS_FILE=/run/secrets/smtp_pass  # SMTP password (use file for production)
SMTP_FROM=noreply@yourdomain.com        # From address for sent emails
```

### Common SMTP Providers

#### Gmail

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password  # Use App Password, not regular password
SMTP_FROM=your-email@gmail.com
```

#### SendGrid

```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
SMTP_FROM=noreply@yourdomain.com
```

#### Mailgun

```bash
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=postmaster@yourdomain.com
SMTP_PASS=your-mailgun-password
SMTP_FROM=noreply@yourdomain.com
```

#### AWS SES

```bash
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-ses-smtp-username
SMTP_PASS=your-ses-smtp-password
SMTP_FROM=noreply@yourdomain.com
```

### Security Best Practices

1. **Use App Passwords**: For Gmail, use App Passwords instead of your main password
2. **Environment Variables**: Store credentials in environment variables, not code
3. **Docker Secrets**: In production, use Docker secrets for sensitive data
4. **TLS/SSL**: Always use encrypted connections (TLS or SSL)

### Docker Setup

For production Docker deployments, use secrets:

```yaml
# docker-compose.prod.yml
services:
    app:
        environment:
            - SMTP_HOST=${SMTP_HOST}
            - SMTP_PORT=${SMTP_PORT}
            - SMTP_SECURE=${SMTP_SECURE}
            - SMTP_USER=${SMTP_USER}
            - SMTP_PASS_FILE=/run/secrets/smtp_pass
            - SMTP_FROM=${SMTP_FROM}
        secrets:
            - smtp_pass
```

Create the secret:

```bash
echo "your-smtp-password" | docker secret create smtp_pass -
```

## Email Templates

### Template Structure

Email templates are located in `src/lib/email/templates/`:

- `base.ts` - Base template with responsive design
- `auth.ts` - Authentication emails (magic links, password reset)
- `notifications.ts` - Activity notification emails
- `index.ts` - Template exports

### Customization

#### Brand Colors

Templates automatically use the brand color specified in the template call:

```typescript
const html = BaseEmailTemplate({
	subject: 'Welcome!',
	brandColor: '#3b82f6', // Custom brand color
	children: '<p>Welcome to our platform!</p>',
})
```

#### Content Customization

Templates support:

- Personalized greetings (user's name)
- Responsive design (mobile-friendly)
- Dark mode support
- Accessibility features (ARIA labels, semantic HTML)

### Template Development

When creating new templates:

1. **Use the BaseEmailTemplate** for consistent styling
2. **Include plain text fallback** for accessibility
3. **Test responsiveness** across email clients
4. **Follow accessibility guidelines** (WCAG 2.1 AA)
5. **Include unsubscribe links** for marketing emails

Example new template:

```typescript
export function WelcomeEmailTemplate({ userName }: { userName?: string }) {
	return BaseEmailTemplate({
		subject: 'Welcome to Constellate!',
		userName,
		children: `
      <p>Welcome to Constellate! We're excited to have you join our community.</p>
      <p>Here are some things you can do:</p>
      <ul>
        <li>Create your first event</li>
        <li>Discover events in your area</li>
        <li>Connect with other users</li>
      </ul>
    `,
	})
}
```

## Email Notifications

### Notification Types

Users can control email notifications for:

- **FOLLOW** - New followers
- **COMMENT** - Comments on user's events
- **LIKE** - Likes on user's events
- **MENTION** - @mentions in comments
- **EVENT** - Event updates and reminders
- **SYSTEM** - Platform announcements

### User Preferences

Users manage email preferences through:

- Web interface: `/notifications` → "Settings" button
- API endpoints: `/api/email-preferences`
- Mobile app (future feature)

#### API Endpoints

```typescript
GET  /api/email-preferences          # Get user preferences
PUT  /api/email-preferences          # Update preferences
POST /api/email-preferences/reset     # Reset to defaults
GET  /api/email-preferences/deliveries # Get delivery history
```

#### Preference Structure

```typescript
interface EmailPreferences {
	FOLLOW: boolean // New followers
	COMMENT: boolean // Comments on events
	LIKE: boolean // Likes on events
	MENTION: boolean // @mentions
	EVENT: boolean // Event updates
	SYSTEM: boolean // Platform announcements
}
```

## Email Delivery Tracking

### Delivery Status

Email delivery is tracked in the `EmailDelivery` model:

- **SENT** - Email sent to SMTP server
- **DELIVERED** - Confirmed delivered to recipient
- **FAILED** - Delivery failed (check error logs)
- **BOUNCED** - Email bounced (invalid address)
- **OPENED** - Recipient opened email (if supported)
- **CLICKED** - Recipient clicked link (if supported)

### Analytics

Monitor email delivery through:

1. **Database queries** on `EmailDelivery` table
2. **Application logs** for SMTP errors
3. **Email provider analytics** (SendGrid, Mailgun, etc.)

Example query:

```sql
-- Email delivery rates by template
SELECT
  templateName,
  COUNT(*) as sent,
  COUNT(CASE WHEN status = 'DELIVERED' THEN 1 END) as delivered,
  COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed
FROM EmailDelivery
WHERE createdAt >= '2024-01-01'
GROUP BY templateName;
```

## Testing

### Development Testing

For development without SMTP:

1. **Set empty SMTP_HOST** - Emails will be logged to console
2. **Use mailcatcher** - Local SMTP server for testing
3. **Use Ethereal.email** - Fake SMTP service

Example with mailcatcher:

```bash
# Run mailcatcher
docker run -p 1025:1025 -p 1080:1080 --name mailcatcher schickling/mailcatcher

# Configure .env
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=test@localhost
```

View emails at: http://localhost:1080

### Template Testing

Test email templates:

```typescript
import { MagicLinkEmailTemplate } from './lib/email/templates/auth.js'

// Test template generation
const html = MagicLinkEmailTemplate({
	userName: 'Test User',
	loginUrl: 'https://example.com/login?token=abc123',
	isSignup: false,
})

console.log(html) // Review output
```

## Troubleshooting

### Common Issues

#### Emails not sending

1. Check SMTP configuration in `.env`
2. Verify network connectivity to SMTP server
3. Check authentication credentials
4. Review application logs

#### Emails going to spam

1. **SPF/DKIM records**: Set up proper DNS records
2. **Domain reputation**: Monitor deliverability
3. **Content**: Avoid spam trigger words
4. **Unsubscribe links**: Include opt-out mechanism

#### Template rendering issues

1. **HTML validation**: Use W3C validator
2. **Client compatibility**: Test in Outlook, Gmail, etc.
3. **Responsive design**: Test on mobile devices
4. **Image loading**: Use absolute URLs, not CID

### Debug Mode

Enable detailed email logging:

```typescript
// In development, emails log to console
if (process.env.NODE_ENV === 'development') {
	console.log('📧 Email Debug:', {
		to: 'user@example.com',
		subject: 'Test Subject',
		html: emailContent,
	})
}
```

## Security Considerations

### Data Protection

- **Never log email content** in production
- **Use HTTPS** for all email links
- **Rate limiting** to prevent email abuse
- **Unsubscribe** functionality for marketing emails

### Authentication

- **Magic links** expire after 15 minutes
- **Single use** links prevent replay attacks
- **HTTPS only** for security
- **Domain validation** in email headers

## Performance Optimization

### Batch Processing

- **Queue emails** for high-volume sending
- **Rate limiting** to respect SMTP limits
- **Retry logic** for failed deliveries
- **Background processing** to avoid blocking requests

### Caching

- **Template caching** for repeated renders
- **Connection pooling** for SMTP
- **DNS caching** for MX record lookups

## Monitoring and Maintenance

### Health Checks

Monitor email system health:

```typescript
// Check SMTP connectivity
const healthCheck = async () => {
	try {
		await transporter.verify()
		console.log('✅ SMTP connection healthy')
	} catch (error) {
		console.error('❌ SMTP connection failed:', error)
	}
}
```

### Log Analysis

Monitor these metrics:

- **Delivery success rate** (target: >95%)
- **Send volume** by hour/day
- **Error rates** by template type
- **User engagement** (open/click rates)

## Migration Guide

### From Basic Emails

1. **Install dependencies**: `npm install`
2. **Run migrations**: `npm run db:push`
3. **Configure SMTP**: Update `.env` file
4. **Test templates**: Send test emails
5. **Update user preferences**: Default to enabled

### Template Migration

Convert existing email templates:

```typescript
// Old approach
await sendEmail({
	to: 'user@example.com',
	subject: 'Login',
	html: '<a href="https://example.com/login">Login</a>',
})

// New approach
const html = MagicLinkEmailTemplate({
	userName: 'John',
	loginUrl: 'https://example.com/login',
})

await sendTemplatedEmail({
	to: 'user@example.com',
	subject: 'Login to Constellate',
	html,
	templateName: 'magic_link',
	userId: user.id,
})
```

## Support

For email configuration issues:

1. **Check logs**: Application logs show detailed errors
2. **Test SMTP**: Use telnet to verify connectivity
3. **Verify credentials**: Test with email client first
4. **Consult provider**: Check SMTP provider documentation

Community support: [GitHub Discussions](https://github.com/your-org/constellate/discussions)
Bug reports: [GitHub Issues](https://github.com/your-org/constellate/issues)
