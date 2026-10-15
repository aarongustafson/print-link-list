import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { definePrintLinkList } from '../define.js';
import { PrintLinkListElement } from '../print-link-list.js';

const MARKER_SELECTOR = '[data-print-link-list-marker]';

function createMain(markup = '') {
	const main = document.createElement('main');
	main.innerHTML = markup;
	document.body.append(main);
	return main;
}

function createElement(attributes = {}) {
	const element = document.createElement('print-link-list');
	for (const [name, value] of Object.entries(attributes)) {
		element.setAttribute(name, value);
	}
	document.body.append(element);
	return element;
}

async function settle() {
	await new Promise((resolve) => requestAnimationFrame(resolve));
	await new Promise((resolve) => requestAnimationFrame(resolve));
}

describe('PrintLinkListElement', () => {
	beforeEach(() => {
		document.body.replaceChildren();
	});

	afterEach(() => {
		document.body.replaceChildren();
		vi.restoreAllMocks();
	});

	it('is defined and supports guarded custom registration', () => {
		expect(customElements.get('print-link-list')).toBe(
			PrintLinkListElement,
		);
		expect(definePrintLinkList()).toBe(true);
		expect(definePrintLinkList()).toBe(true);
	});

	it('uses main and Links as its defaults', () => {
		createMain('<a href="/about">About us</a>');
		const element = createElement();

		expect(element.target).toBe('main');
		expect(element.heading).toBe('Links');
		expect(element.shadowRoot.querySelector('h2').textContent).toBe(
			'Links',
		);
	});

	it('resolves destinations and adds accessible print-only markers', () => {
		const main = createMain('<a href="/about">About us</a>');
		const element = createElement();
		const marker = main.querySelector(MARKER_SELECTOR);
		const destination = element.shadowRoot.querySelector(
			'[part="destination"]',
		);

		expect(marker.textContent).toBe('1');
		expect(marker.getAttribute('aria-hidden')).toBe('true');
		expect(destination.textContent).toBe(
			new URL('/about', document.baseURI).href,
		);
		expect(destination.href).toBe(new URL('/about', document.baseURI).href);
		expect(element.hasAttribute('empty')).toBe(false);
	});

	it('deduplicates destinations while reusing marker numbers', () => {
		const main = createMain(`
			<a href="https://example.com/docs">Documentation</a>
			<a href="https://example.com/docs">Read the docs</a>
		`);
		const element = createElement();
		const markers = main.querySelectorAll(MARKER_SELECTOR);

		expect(markers).toHaveLength(2);
		expect([...markers].map((marker) => marker.textContent)).toEqual([
			'1',
			'1',
		]);
		expect(element.shadowRoot.querySelectorAll('li')).toHaveLength(1);
	});

	it('collects citation URLs in document order', () => {
		const main = createMain(`
			<blockquote cite="/sources/one">A quotation</blockquote>
			<q cite="https://example.com/two">Another quotation</q>
		`);
		const element = createElement();
		const markers = main.querySelectorAll(MARKER_SELECTOR);

		expect(
			[
				...element.shadowRoot.querySelectorAll('[part="destination"]'),
			].map((link) => link.textContent),
		).toEqual([
			new URL('/sources/one', document.baseURI).href,
			'https://example.com/two',
		]);
		expect([...markers].map((marker) => marker.textContent)).toEqual([
			'Source 1',
			'Source 2',
		]);
		expect(
			[...markers].every((marker) => marker.localName === 'span'),
		).toBe(true);
		expect(
			[...markers].map(
				(marker) => marker.querySelector('sup').textContent,
			),
		).toEqual(['1', '2']);
	});

	it('supports a translatable citation source label', () => {
		const main = createMain(
			'<blockquote cite="https://example.com/source">Quotation</blockquote>',
		);
		const element = createElement({ 'label-source': 'Fuente' });
		const marker = main.querySelector(MARKER_SELECTOR);

		expect(element.labelSource).toBe('Fuente');
		expect(marker.textContent).toBe('Fuente 1');

		element.labelSource = 'Quelle';
		expect(element.getAttribute('label-source')).toBe('Quelle');
		expect(main.querySelector(MARKER_SELECTOR).textContent).toBe(
			'Quelle 1',
		);

		element.labelSource = null;
		expect(element.labelSource).toBe('Source');
		expect(main.querySelector(MARKER_SELECTOR).textContent).toBe(
			'Source 1',
		);
	});

	it('ignores fragments, script URLs, unsupported schemes, and opt-outs', () => {
		const main = createMain(`
			<a href="#section">Section</a>
			<a href="javascript:void(0)">Action</a>
			<a href="ftp://example.com/file">FTP</a>
			<div data-print-link-list-ignore>
				<a href="https://example.com/ignored">Ignored</a>
			</div>
			<a href="https://example.com/included">Included</a>
		`);
		const element = createElement();

		expect(main.querySelectorAll(MARKER_SELECTOR)).toHaveLength(1);
		expect(element.shadowRoot.querySelectorAll('li')).toHaveLength(1);
		expect(element.shadowRoot.textContent).toContain(
			'https://example.com/included',
		);
	});

	it('formats mail and telephone links when text hides the destination', () => {
		const main = createMain(`
			<a href="mailto:hello%40example.com?subject=Hello">Email us</a>
			<a href="mailto:shown@example.com">shown@example.com</a>
			<a href="tel:+15551234567">Call support</a>
			<a href="tel:+15557654321">+1 (555) 765-4321</a>
		`);
		const element = createElement();
		const destinations = [
			...element.shadowRoot.querySelectorAll('[part="destination"]'),
		].map((link) => link.textContent);

		expect(destinations).toEqual(['hello@example.com', '+15551234567']);
		expect(main.querySelectorAll(MARKER_SELECTOR)).toHaveLength(2);
	});

	it('omits download destinations already communicated by their text', () => {
		const href = 'https://example.com/files/report.pdf';
		const main = createMain(`
			<a href="${href}" download>${href}</a>
			<a href="https://example.com/files/data.csv" download>Download the data</a>
		`);
		const element = createElement();

		expect(main.querySelectorAll(MARKER_SELECTOR)).toHaveLength(1);
		expect(element.shadowRoot.textContent).toContain(
			'https://example.com/files/data.csv',
		);
	});

	it('supports custom targets and reflected properties', () => {
		createMain('<a href="https://example.com/main">Main</a>');
		const article = document.createElement('article');
		article.className = 'printable';
		article.innerHTML = '<a href="https://example.com/article">Article</a>';
		document.body.append(article);
		const element = createElement({
			heading: 'References',
			target: '.printable',
		});

		expect(element.target).toBe('.printable');
		expect(element.heading).toBe('References');
		expect(element.shadowRoot.textContent).toContain(
			'https://example.com/article',
		);
		expect(
			document.querySelector('main').querySelector(MARKER_SELECTOR),
		).toBe(null);

		element.target = null;
		element.heading = null;
		expect(element.target).toBe('main');
		expect(element.heading).toBe('Links');
	});

	it('dispatches update details after successful processing', () => {
		createMain(`
			<a href="https://example.com/one">One</a>
			<a href="https://example.com/one">One again</a>
			<a href="https://example.com/two">Two</a>
		`);
		const element = document.createElement('print-link-list');
		const listener = vi.fn();
		element.addEventListener('print-link-list:update', listener);
		document.body.append(element);

		expect(listener).toHaveBeenCalledOnce();
		expect(listener.mock.calls[0][0].detail).toEqual({
			destinations: 2,
			references: 3,
		});
	});

	it.each([
		{
			selector: '[',
			type: 'invalid-target',
		},
		{
			selector: '.missing',
			type: 'target-not-found',
		},
	])('reports $type without throwing', ({ selector, type }) => {
		const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const element = document.createElement('print-link-list');
		const listener = vi.fn();
		element.target = selector;
		element.addEventListener('print-link-list:error', listener);

		expect(() => document.body.append(element)).not.toThrow();
		expect(warning).toHaveBeenCalledWith(
			expect.stringMatching(/^<print-link-list> - /),
		);
		expect(listener).toHaveBeenCalledOnce();
		expect(listener.mock.calls[0][0].detail).toMatchObject({
			selector,
			type,
		});
		expect(element.shadowRoot.querySelectorAll('li')).toHaveLength(0);
	});

	it('keeps output synchronized with dynamic content', async () => {
		const main = createMain('<a href="https://example.com/one">One</a>');
		const element = createElement();
		const link = document.createElement('a');
		link.href = 'https://example.com/two';
		link.textContent = 'Two';
		main.prepend(link);
		await settle();

		expect(
			[...main.querySelectorAll(MARKER_SELECTOR)].map(
				(marker) => marker.textContent,
			),
		).toEqual(['1', '2']);
		expect(element.shadowRoot.querySelectorAll('li')).toHaveLength(2);

		link.remove();
		await settle();
		expect(main.querySelectorAll(MARKER_SELECTOR)).toHaveLength(1);
		expect(element.shadowRoot.querySelectorAll('li')).toHaveLength(1);
		expect(main.querySelector(MARKER_SELECTOR).textContent).toBe('1');
	});

	it('rebuilds when relevant attributes and link text change', async () => {
		const main = createMain(
			'<a href="mailto:test@example.com">Email us</a>',
		);
		const element = createElement();
		const link = main.querySelector('a');

		expect(element.shadowRoot.querySelectorAll('li')).toHaveLength(1);
		link.textContent = 'test@example.com';
		await settle();
		expect(element.shadowRoot.querySelectorAll('li')).toHaveLength(0);

		link.href = 'https://example.com/profile';
		link.textContent = 'Profile';
		await settle();
		expect(element.shadowRoot.textContent).toContain(
			'https://example.com/profile',
		);
	});

	it('cleans up its markers and shared styles when disconnected', () => {
		const main = createMain('<a href="https://example.com">Example</a>');
		const element = createElement();

		expect(
			document.head.querySelector('[data-print-link-list-styles]'),
		).toBeTruthy();
		element.remove();
		expect(main.querySelector(MARKER_SELECTOR)).toBe(null);
		expect(
			document.head.querySelector('[data-print-link-list-styles]'),
		).toBe(null);
	});

	it('keeps markers and shared styles owned by other instances', () => {
		const main = createMain('<a href="https://example.com">Example</a>');
		const first = createElement();
		const second = createElement();

		expect(main.querySelectorAll(MARKER_SELECTOR)).toHaveLength(2);
		expect(
			document.head.querySelectorAll('[data-print-link-list-styles]'),
		).toHaveLength(1);

		first.remove();
		expect(main.querySelectorAll(MARKER_SELECTOR)).toHaveLength(1);
		expect(
			document.head.querySelector('[data-print-link-list-styles]'),
		).toBeTruthy();

		second.remove();
		expect(main.querySelectorAll(MARKER_SELECTOR)).toHaveLength(0);
		expect(
			document.head.querySelector('[data-print-link-list-styles]'),
		).toBe(null);
	});
});
