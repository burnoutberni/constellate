/**
 * Tests for Email Helper
 * Tests for email sending functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock nodemailer before importing email module
const mockSendMail = vi.fn()
vi.mock('nodemailer', () => ({
    default: {
        createTransport: vi.fn(() => ({
            sendMail: mockSendMail,
        })),
    },
    createTransport: vi.fn(() => ({
        sendMail: mockSendMail,
    })),
}))

// Mock config
vi.mock('../../config.js', () => ({
    config: {
        smtp: {
            host: 'smtp.example.com',
            port: 587,
            secure: false,
            user: 'test@example.com',
            pass: 'password',
            from: 'noreply@example.com',
        },
    },
}))

// Import after mocks
const { sendEmail } = await import('../../lib/email.js')

describe('Email Helper', () => {

    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('sendEmail', () => {
        it('should send email with correct parameters', async () => {
            mockSendMail.mockResolvedValue({ messageId: 'test-message-id' })

            await sendEmail({
                to: 'recipient@example.com',
                subject: 'Test Subject',
                text: 'Test email body',
                html: '<p>Test email body</p>',
            })

            expect(mockSendMail).toHaveBeenCalledWith({
                from: 'noreply@example.com',
                to: 'recipient@example.com',
                subject: 'Test Subject',
                text: 'Test email body',
                html: '<p>Test email body</p>',
            })
        })

        it('should send email without HTML content', async () => {
            mockSendMail.mockResolvedValue({ messageId: 'test-message-id' })

            await sendEmail({
                to: 'recipient@example.com',
                subject: 'Test Subject',
                text: 'Test email body',
            })

            expect(mockSendMail).toHaveBeenCalledWith({
                from: 'noreply@example.com',
                to: 'recipient@example.com',
                subject: 'Test Subject',
                text: 'Test email body',
                html: undefined,
            })
        })

        it('should handle email sending errors', async () => {
            mockSendMail.mockRejectedValue(new Error('SMTP error'))

            await expect(
                sendEmail({
                    to: 'recipient@example.com',
                    subject: 'Test Subject',
                    text: 'Test email body',
                })
            ).rejects.toThrow('SMTP error')
        })
    })

})
