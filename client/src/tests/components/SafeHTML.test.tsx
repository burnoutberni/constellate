import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SafeHTML } from '../../components/ui'

describe('SafeHTML Component', () => {
	it('should render formatted HTML content that users can see', () => {
		const { container } = render(<SafeHTML html="<p>Hello <strong>world</strong>!</p>" />)

		// User can see the text content
		expect(container.textContent).toContain('Hello')
		expect(container.textContent).toContain('world')
		// User can see the bold formatting
		const strongElement = screen.getByText('world')
		expect(strongElement).toBeInTheDocument()
		expect(strongElement.tagName).toBe('STRONG')
	})

	it('should render headings that users can see', () => {
		render(<SafeHTML html="<h1>Main Title</h1><h2>Subtitle</h2>" />)

		expect(screen.getByRole('heading', { name: 'Main Title', level: 1 })).toBeInTheDocument()
		expect(screen.getByRole('heading', { name: 'Subtitle', level: 2 })).toBeInTheDocument()
	})

	it('should render lists that users can interact with', () => {
		render(
			<SafeHTML html="<ul><li>Item 1</li><li>Item 2</li></ul><ol><li>First</li><li>Second</li></ol>" />
		)

		const listItems = screen.getAllByRole('listitem')
		expect(listItems).toHaveLength(4)
		expect(listItems[0]).toHaveTextContent('Item 1')
		expect(listItems[1]).toHaveTextContent('Item 2')
		expect(listItems[2]).toHaveTextContent('First')
		expect(listItems[3]).toHaveTextContent('Second')
	})

	it('should render links that users can click with security attributes', () => {
		render(
			<SafeHTML html='<p>Visit <a href="https://example.com">Example</a> for more info.</p>' />
		)

		const link = screen.getByRole('link', { name: 'Example' })
		expect(link).toBeInTheDocument()
		expect(link).toHaveAttribute('href', 'https://example.com')
		expect(link).toHaveAttribute('rel', 'noopener noreferrer')
	})

	it('should block dangerous scripts and prevent XSS attacks', () => {
		const dangerousHTML = '<p>Safe content</p><script>alert("XSS")</script><p>More content</p>'
		render(<SafeHTML html={dangerousHTML} />)

		// User should see the safe content
		expect(screen.getByText('Safe content')).toBeInTheDocument()
		expect(screen.getByText('More content')).toBeInTheDocument()

		// Script tag should not be in the DOM
		const scripts = document.querySelectorAll('script')
		expect(scripts.length).toBe(0)

		// Verify no alert was triggered (by checking the rendered HTML doesn't contain script)
		const container = screen.getByText('Safe content').parentElement
		expect(container?.innerHTML).not.toContain('<script>')
	})

	it('should block iframes that could be used for attacks', () => {
		const dangerousHTML = '<p>Content</p><iframe src="evil.com"></iframe><p>More</p>'
		render(<SafeHTML html={dangerousHTML} />)

		expect(screen.getByText('Content')).toBeInTheDocument()
		expect(screen.getByText('More')).toBeInTheDocument()

		// Iframe should not be in the DOM
		const iframes = document.querySelectorAll('iframe')
		expect(iframes.length).toBe(0)
	})

	it('should remove event handlers that could execute malicious code', () => {
		const dangerousHTML = '<p onclick="alert(\'XSS\')">Click me</p>'
		render(<SafeHTML html={dangerousHTML} />)

		const paragraph = screen.getByText('Click me')
		expect(paragraph).toBeInTheDocument()

		// onclick attribute should be removed
		expect(paragraph).not.toHaveAttribute('onclick')
	})

	it('should render nothing when html is empty', () => {
		const { container } = render(<SafeHTML html="" />)
		expect(container.firstChild).toBeNull()
	})

	it('should render nothing when html is null', () => {
		const { container } = render(<SafeHTML html={null} />)
		expect(container.firstChild).toBeNull()
	})

	it('should render nothing when html is undefined', () => {
		const { container } = render(<SafeHTML html={undefined} />)
		expect(container.firstChild).toBeNull()
	})

	it('should render complex HTML with multiple formatting tags', () => {
		const complexHTML = `
			<div>
				<h2>Event Description</h2>
				<p>Join us for an amazing <strong>conference</strong> featuring:</p>
				<ul>
					<li>Keynote <em>speakers</em></li>
					<li>Networking sessions</li>
					<li>Workshops and <a href="https://example.com">more info</a></li>
				</ul>
				<p>Don't miss out!</p>
			</div>
		`
		render(<SafeHTML html={complexHTML} />)

		expect(screen.getByRole('heading', { name: 'Event Description' })).toBeInTheDocument()
		expect(screen.getByText(/Join us for an amazing/)).toBeInTheDocument()
		expect(screen.getByText('conference', { selector: 'strong' })).toBeInTheDocument()
		expect(screen.getByText('speakers', { selector: 'em' })).toBeInTheDocument()
		expect(screen.getByRole('link', { name: 'more info' })).toBeInTheDocument()
	})

	it('should apply custom className that affects styling', () => {
		render(<SafeHTML html="<p>Styled content</p>" className="text-lg text-blue-600" />)

		const container = screen.getByText('Styled content').parentElement
		expect(container).toHaveClass('text-lg', 'text-blue-600')
	})

	it('should render using custom tag when specified', () => {
		render(<SafeHTML html="<p>Content</p>" tag="span" />)

		const container = screen.getByText('Content').parentElement
		expect(container?.tagName).toBe('SPAN')
	})

	it('should preserve safe formatting like bold and italic', () => {
		render(<SafeHTML html="<p>This is <strong>bold</strong> and <em>italic</em> text.</p>" />)

		const bold = screen.getByText('bold', { selector: 'strong' })
		const italic = screen.getByText('italic', { selector: 'em' })
		expect(bold).toBeInTheDocument()
		expect(italic).toBeInTheDocument()
	})

	it('should render code blocks that users can read', () => {
		render(
			<SafeHTML html="<p>Use <code>console.log()</code> to debug.</p><pre><code>function test() {}</code></pre>" />
		)

		expect(screen.getByText('console.log()', { selector: 'code' })).toBeInTheDocument()
		expect(screen.getByText('function test() {}', { selector: 'code' })).toBeInTheDocument()
	})

	it('should render blockquotes that users can see', () => {
		render(
			<SafeHTML html="<blockquote>This is an important quote with <strong>emphasis</strong>.</blockquote>" />
		)

		const quote = screen.getByText(/This is an important quote/)
		expect(quote.tagName).toBe('BLOCKQUOTE')
		expect(screen.getByText('emphasis', { selector: 'strong' })).toBeInTheDocument()
	})

	it('should handle mailto links safely', () => {
		render(
			<SafeHTML html='<p>Email <a href="mailto:contact@example.com">contact@example.com</a></p>' />
		)

		const link = screen.getByRole('link', { name: 'contact@example.com' })
		expect(link).toBeInTheDocument()
		expect(link).toHaveAttribute('href', 'mailto:contact@example.com')
	})

	it('should strip dangerous attributes from safe tags', () => {
		const dangerousHTML = '<p onmouseover="alert(1)" style="color: red;">Content</p>'
		render(<SafeHTML html={dangerousHTML} />)

		const paragraph = screen.getByText('Content')
		expect(paragraph).toBeInTheDocument()
		// onmouseover should be removed
		expect(paragraph).not.toHaveAttribute('onmouseover')
		// style should be removed (not in ALLOWED_ATTR)
		expect(paragraph).not.toHaveAttribute('style')
	})

	it('should handle multiple links in the same content', () => {
		render(
			<SafeHTML html='<p>Visit <a href="https://site1.com">Site 1</a> and <a href="https://site2.com">Site 2</a>.</p>' />
		)

		const links = screen.getAllByRole('link')
		expect(links).toHaveLength(2)
		expect(links[0]).toHaveTextContent('Site 1')
		expect(links[0]).toHaveAttribute('href', 'https://site1.com')
		expect(links[0]).toHaveAttribute('rel', 'noopener noreferrer')
		expect(links[1]).toHaveTextContent('Site 2')
		expect(links[1]).toHaveAttribute('href', 'https://site2.com')
		expect(links[1]).toHaveAttribute('rel', 'noopener noreferrer')
	})

	it('should preserve line breaks that affect layout', () => {
		render(<SafeHTML html="<p>Line 1<br />Line 2</p>" />)

		const paragraph = screen.getByText(/Line 1/)
		expect(paragraph).toBeInTheDocument()
		// Check that br tag exists in the rendered HTML
		expect(paragraph.innerHTML).toContain('<br>')
	})
})
