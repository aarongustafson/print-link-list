import { PrintLinkListElement } from './print-link-list.js';

export function definePrintLinkList() {
	const registry =
		typeof window !== 'undefined' ? window.customElements : undefined;

	if (!registry || typeof registry.define !== 'function') {
		return false;
	}

	if (!registry.get('print-link-list')) {
		registry.define('print-link-list', PrintLinkListElement);
	}

	return true;
}

definePrintLinkList();
