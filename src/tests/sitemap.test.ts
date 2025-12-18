/**
 * Tests for Sitemap Generation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { config } from 'dotenv'
config()
import { app } from '../server.js'
import { prisma } from '../lib/prisma.js'

describe('Sitemap API', () => {
	beforeEach(async () => {
		await prisma.event.deleteMany({})
		await prisma.user.deleteMany({})
	})

	describe('GET /sitemap.xml', () => {
		it('includes all users in sitemap regardless of privacy setting', async () => {
			const publicUser = await prisma.user.create({
				data: {
					username: `public_${Date.now()}`,
					email: `public_${Date.now()}@test.com`,
					isRemote: false,
					isPublicProfile: true,
				},
			})

			const privateUser = await prisma.user.create({
				data: {
					username: `private_${Date.now()}`,
					email: `private_${Date.now()}@test.com`,
					isRemote: false,
					isPublicProfile: false,
				},
			})

			const response = await app.request('/sitemap.xml', {
				method: 'GET',
			})
			expect(response.status).toBe(200)

			const xml = await response.text()
			expect(xml).toContain(`/@${encodeURIComponent(publicUser.username)}`)
			expect(xml).toContain(`/@${encodeURIComponent(privateUser.username)}`)
		})

		it('includes public events in sitemap', async () => {
			const user = await prisma.user.create({
				data: {
					username: `eventuser_${Date.now()}`,
					email: `eventuser_${Date.now()}@test.com`,
					isRemote: false,
				},
			})

			const publicEvent = await prisma.event.create({
				data: {
					title: 'Public Event',
					startTime: new Date(),
					userId: user.id,
					visibility: 'PUBLIC',
				},
			})

			const privateEvent = await prisma.event.create({
				data: {
					title: 'Private Event',
					startTime: new Date(),
					userId: user.id,
					visibility: 'PRIVATE',
				},
			})

			const response = await app.request('/sitemap.xml', {
				method: 'GET',
			})
			expect(response.status).toBe(200)

			const xml = await response.text()
			expect(xml).toContain(`/@${encodeURIComponent(user.username)}/${publicEvent.id}`)
			expect(xml).not.toContain(`/${privateEvent.id}`)
		})

		it('includes static pages in sitemap', async () => {
			const response = await app.request('/sitemap.xml', {
				method: 'GET',
			})
			expect(response.status).toBe(200)

			const xml = await response.text()
			expect(xml).toContain('<loc>')
			expect(xml).toContain('/')
			expect(xml).toContain('/about')
			expect(xml).toContain('/discover')
		})
	})

	describe('GET /robots.txt', () => {
		it('returns robots.txt with sitemap URL', async () => {
			const response = await app.request('/robots.txt', {
				method: 'GET',
			})
			expect(response.status).toBe(200)

			const text = await response.text()
			expect(text).toContain('User-agent: *')
			expect(text).toContain('Sitemap:')
			expect(text).toContain('/sitemap.xml')
		})
	})
})
