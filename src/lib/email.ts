import * as nodemailer from 'nodemailer'
import { config } from '../config.js'

const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
    },
})

export async function sendEmail({
    to,
    subject,
    text,
    html,
}: {
    to: string
    subject: string
    text: string
    html?: string
}) {
    if (!config.smtp.host) {
        console.log('⚠️ SMTP not configured, skipping email sending')
        console.log(`To: ${to}`)
        console.log(`Subject: ${subject}`)
        console.log(`Text: ${text}`)
        return
    }

    try {
        const info = await transporter.sendMail({
            from: config.smtp.from,
            to,
            subject,
            text,
            html,
        })
        console.log(`📧 Email sent: ${info.messageId}`)
    } catch (error) {
        console.error('❌ Error sending email:', error)
        throw error
    }
}
