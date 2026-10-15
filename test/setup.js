import { beforeAll } from 'vitest';
import { PrintLinkListElement } from '../print-link-list.js';

const elementName = 'print-link-list'.toLowerCase();

// Define the custom element before tests run
beforeAll(() => {
	if (!customElements.get(elementName)) {
		customElements.define(elementName, PrintLinkListElement);
	}

	// Make the class available globally for testing static methods
	globalThis.PrintLinkListElement = PrintLinkListElement;
});
