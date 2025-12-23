import type { SentMessageInfo } from 'nodemailer'

export interface TestSentMessageInfo extends SentMessageInfo {
	html: string
}
