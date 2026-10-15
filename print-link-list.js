const DEFAULT_TARGET = 'main';
const DEFAULT_HEADING = 'Links';
const DEFAULT_SOURCE_LABEL = 'Source';
const IGNORE_ATTRIBUTE = 'data-print-link-list-ignore';
const MARKER_ATTRIBUTE = 'data-print-link-list-marker';
const OWNER_ATTRIBUTE = 'data-print-link-list-owner';
const sharedStyles = new WeakMap();

let instanceCount = 0;

function normalizeText(value) {
	return value.replace(/\s+/g, ' ').trim();
}

function decode(value) {
	try {
		return decodeURIComponent(value);
	} catch (error) {
		if (error instanceof URIError) {
			return value;
		}
		throw error;
	}
}

function normalizePhone(value) {
	return value.toLowerCase().replace(/[^\da-z+]/g, '');
}

function communicatesDestination(element, rawValue, destination, protocol) {
	const text = normalizeText(element.textContent ?? '');
	if (!text) {
		return false;
	}

	if (protocol === 'tel:') {
		return normalizePhone(text) === normalizePhone(destination);
	}

	const normalizedText = text.toLowerCase();
	return (
		normalizedText === normalizeText(destination).toLowerCase() ||
		normalizedText === normalizeText(rawValue).toLowerCase()
	);
}

function getReference(element, baseURL) {
	const isAnchor = element.localName === 'a' && element.hasAttribute('href');
	const rawValue = element.getAttribute(isAnchor ? 'href' : 'cite')?.trim();

	if (!rawValue || (isAnchor && rawValue.startsWith('#'))) {
		return null;
	}

	let url;
	try {
		url = new URL(rawValue, baseURL);
	} catch (error) {
		if (error instanceof TypeError) {
			return null;
		}
		throw error;
	}

	if (url.protocol === 'http:' || url.protocol === 'https:') {
		const destination = url.href;
		if (
			isAnchor &&
			element.hasAttribute('download') &&
			communicatesDestination(
				element,
				rawValue,
				destination,
				url.protocol,
			)
		) {
			return null;
		}

		return {
			destination,
			href: destination,
			key: destination,
		};
	}

	if (!isAnchor || (url.protocol !== 'mailto:' && url.protocol !== 'tel:')) {
		return null;
	}

	const destination = decode(url.pathname);
	if (
		!destination ||
		communicatesDestination(element, rawValue, destination, url.protocol)
	) {
		return null;
	}

	const key =
		url.protocol === 'tel:'
			? `tel:${normalizePhone(destination)}`
			: `mailto:${destination.toLowerCase()}`;

	return {
		destination,
		href: `${url.protocol}${url.pathname}`,
		key,
	};
}

function installSharedStyles(document) {
	const existing = sharedStyles.get(document);
	if (existing) {
		existing.count += 1;
		return;
	}

	const style = document.createElement('style');
	style.setAttribute('data-print-link-list-styles', '');
	style.textContent = `
		[${MARKER_ATTRIBUTE}] {
			display: none;
		}

		@media print {
			[${MARKER_ATTRIBUTE}] {
				display: inline;
				margin-inline-start: var(--print-link-list-marker-gap, 0.15em);
			}

			sup[${MARKER_ATTRIBUTE}],
			[${MARKER_ATTRIBUTE}] > sup {
				font-size: var(--print-link-list-marker-font-size, 0.75em);
				line-height: 0;
				vertical-align: super;
			}
		}
	`;
	document.head.append(style);
	sharedStyles.set(document, { count: 1, style });
}

function uninstallSharedStyles(document) {
	const existing = sharedStyles.get(document);
	if (!existing) {
		return;
	}

	existing.count -= 1;
	if (existing.count === 0) {
		existing.style.remove();
		sharedStyles.delete(document);
	}
}

/**
 * Generates a deduplicated print-only list of links and citations.
 *
 * @element print-link-list
 *
 * @attr {string} target - Selector for the content to inspect. Defaults to `main`.
 * @attr {string} heading - Heading rendered above the link list. Defaults to `Links`.
 * @attr {string} label-source - Label rendered before citation markers. Defaults to `Source`.
 *
 * @fires print-link-list:update - Fired after a successful rebuild.
 * @fires print-link-list:error - Fired when the target selector is invalid or unmatched.
 *
 * @csspart heading - The list heading.
 * @csspart list - The ordered list.
 * @csspart item - A list item.
 * @csspart destination - A linked destination.
 *
 * @cssprop [--print-link-list-marker-gap=0.15em] - Space before a reference marker.
 * @cssprop [--print-link-list-marker-font-size=0.75em] - Reference marker size.
 * @cssprop [--print-link-list-margin=2rem] - Space before the printed list.
 */
export class PrintLinkListElement extends HTMLElement {
	static get observedAttributes() {
		return ['target', 'heading', 'label-source'];
	}

	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
		this._owner = `print-link-list-${++instanceCount}`;
		this._targetElement = null;
		this._observer = null;
		this._scheduledRefresh = 0;
		this._stylesInstalled = false;
		this._render();
	}

	connectedCallback() {
		this._upgradeProperty('target');
		this._upgradeProperty('heading');
		this._upgradeProperty('labelSource');

		if (!this._stylesInstalled) {
			installSharedStyles(this.ownerDocument);
			this._stylesInstalled = true;
		}

		this.refresh();
	}

	disconnectedCallback() {
		this._disconnectObserver();
		this._cancelScheduledRefresh();
		this._removeMarkers();
		this._clearList();

		if (this._stylesInstalled) {
			uninstallSharedStyles(this.ownerDocument);
			this._stylesInstalled = false;
		}
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (oldValue === newValue || !this.isConnected) {
			return;
		}

		if (name === 'heading') {
			this._refs.heading.textContent = this.heading;
			return;
		}

		this.refresh();
	}

	get target() {
		return this.getAttribute('target') || DEFAULT_TARGET;
	}

	set target(value) {
		if (value === null || value === undefined) {
			this.removeAttribute('target');
		} else {
			this.setAttribute('target', value);
		}
	}

	get heading() {
		return this.getAttribute('heading') || DEFAULT_HEADING;
	}

	set heading(value) {
		if (value === null || value === undefined) {
			this.removeAttribute('heading');
		} else {
			this.setAttribute('heading', value);
		}
	}

	get labelSource() {
		return this.getAttribute('label-source') ?? DEFAULT_SOURCE_LABEL;
	}

	set labelSource(value) {
		if (value === null || value === undefined) {
			this.removeAttribute('label-source');
		} else {
			this.setAttribute('label-source', value);
		}
	}

	refresh() {
		this._disconnectObserver();
		this._cancelScheduledRefresh();
		this._removeMarkers();
		this._clearList();

		const target = this._resolveTarget();
		if (!target) {
			return false;
		}

		this._targetElement = target;
		const references = this._collectReferences(target);
		this._renderReferences(references);
		this._observeTarget();
		this.dispatchEvent(
			new CustomEvent('print-link-list:update', {
				bubbles: true,
				composed: true,
				detail: {
					destinations: new Set(
						references.map(({ reference }) => reference.key),
					).size,
					references: references.length,
				},
			}),
		);
		return true;
	}

	_upgradeProperty(property) {
		if (Object.prototype.hasOwnProperty.call(this, property)) {
			const value = this[property];
			delete this[property];
			this[property] = value;
		}
	}

	_resolveTarget() {
		const selector = this.target;
		let target;

		try {
			target = this.ownerDocument.querySelector(selector);
		} catch (error) {
			if (error instanceof DOMException || error instanceof SyntaxError) {
				this._reportError(
					'invalid-target',
					selector,
					`The target selector "${selector}" is invalid.`,
				);
				return null;
			}
			throw error;
		}

		if (!target) {
			this._reportError(
				'target-not-found',
				selector,
				`The target selector "${selector}" did not match an element.`,
			);
			return null;
		}

		return target;
	}

	_collectReferences(target) {
		const references = [];
		const numbers = new Map();

		for (const element of target.querySelectorAll('a[href], [cite]')) {
			if (
				this.contains(element) ||
				element.hasAttribute(MARKER_ATTRIBUTE) ||
				element.closest(`[${IGNORE_ATTRIBUTE}]`)
			) {
				continue;
			}

			const reference = getReference(element, this.ownerDocument.baseURI);
			if (!reference) {
				continue;
			}

			if (!numbers.has(reference.key)) {
				numbers.set(reference.key, numbers.size + 1);
			}

			references.push({
				element,
				isCitation:
					element.localName !== 'a' || !element.hasAttribute('href'),
				number: numbers.get(reference.key),
				reference,
			});
		}

		return references;
	}

	_renderReferences(references) {
		const destinations = new Map();
		const fragment = this.ownerDocument.createDocumentFragment();

		for (const item of references) {
			const marker = item.isCitation
				? this._createCitationMarker(item.number)
				: this._createLinkMarker(item.number);
			marker.setAttribute(MARKER_ATTRIBUTE, '');
			marker.setAttribute(OWNER_ATTRIBUTE, this._owner);
			marker.setAttribute('aria-hidden', 'true');
			item.element.after(marker);

			if (!destinations.has(item.reference.key)) {
				destinations.set(item.reference.key, item);
			}
		}

		for (const item of destinations.values()) {
			const listItem = this.ownerDocument.createElement('li');
			const destination = this.ownerDocument.createElement('a');
			listItem.setAttribute('part', 'item');
			destination.setAttribute('part', 'destination');
			destination.href = item.reference.href;
			destination.textContent = item.reference.destination;
			listItem.append(destination);
			fragment.append(listItem);
		}

		this._refs.heading.textContent = this.heading;
		this._refs.list.append(fragment);
		this.toggleAttribute('empty', destinations.size === 0);
	}

	_createLinkMarker(number) {
		const marker = this.ownerDocument.createElement('sup');
		marker.textContent = String(number);
		return marker;
	}

	_createCitationMarker(number) {
		const marker = this.ownerDocument.createElement('span');
		const note = this.ownerDocument.createElement('sup');
		const label = this.labelSource;
		note.textContent = String(number);

		if (label) {
			marker.append(`${label} `);
		}
		marker.append(note);
		return marker;
	}

	_render() {
		this.shadowRoot.innerHTML = `
			<style>
				:host {
					display: none;
					margin-block-start: var(--print-link-list-margin, 2rem);
				}

				:host([hidden]),
				:host([empty]) {
					display: none;
				}

				h2 {
					font: inherit;
					font-weight: bold;
				}

				ol {
					padding-inline-start: 2em;
				}

				a {
					color: inherit;
					overflow-wrap: anywhere;
					text-decoration: none;
				}

				@media print {
					:host(:not([hidden], [empty])) {
						display: block;
					}
				}
			</style>
			<h2 part="heading"></h2>
			<ol part="list"></ol>
		`;

		this._refs = {
			heading: this.shadowRoot.querySelector('h2'),
			list: this.shadowRoot.querySelector('ol'),
		};
	}

	_clearList() {
		this._refs.list.replaceChildren();
		this.toggleAttribute('empty', true);
		this._targetElement = null;
	}

	_removeMarkers() {
		if (!this._targetElement) {
			return;
		}

		for (const marker of this._targetElement.querySelectorAll(
			`[${MARKER_ATTRIBUTE}][${OWNER_ATTRIBUTE}="${this._owner}"]`,
		)) {
			marker.remove();
		}
	}

	_observeTarget() {
		this._observer = new MutationObserver(() => {
			if (this._scheduledRefresh) {
				return;
			}

			this._scheduledRefresh = requestAnimationFrame(() => {
				this._scheduledRefresh = 0;
				if (this.isConnected) {
					this.refresh();
				}
			});
		});
		this._observer.observe(this._targetElement, {
			attributes: true,
			attributeFilter: ['href', 'cite', 'download', IGNORE_ATTRIBUTE],
			characterData: true,
			childList: true,
			subtree: true,
		});
	}

	_disconnectObserver() {
		this._observer?.disconnect();
		this._observer = null;
	}

	_cancelScheduledRefresh() {
		if (this._scheduledRefresh) {
			cancelAnimationFrame(this._scheduledRefresh);
			this._scheduledRefresh = 0;
		}
	}

	_reportError(type, selector, message) {
		console.warn(`<print-link-list> - ${message}`);
		this.dispatchEvent(
			new CustomEvent('print-link-list:error', {
				bubbles: true,
				composed: true,
				detail: { message, selector, type },
			}),
		);
	}
}
