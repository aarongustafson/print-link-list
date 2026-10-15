export interface PrintLinkListUpdateDetail {
	destinations: number;
	references: number;
}

export type PrintLinkListErrorType =
	| 'invalid-target'
	| 'target-not-found';

export interface PrintLinkListErrorDetail {
	message: string;
	selector: string;
	type: PrintLinkListErrorType;
}

export class PrintLinkListElement extends HTMLElement {
	static readonly observedAttributes: string[];

	constructor();

	connectedCallback(): void;
	disconnectedCallback(): void;
	attributeChangedCallback(
		name: string,
		oldValue: string | null,
		newValue: string | null,
	): void;

	get target(): string;
	set target(value: string | null | undefined);

	get heading(): string;
	set heading(value: string | null | undefined);

	get labelSource(): string;
	set labelSource(value: string | null | undefined);

	/**
	 * Rebuild the markers and destination list.
	 * @returns Whether the configured target was found and processed.
	 */
	refresh(): boolean;

	addEventListener(
		type: 'print-link-list:update',
		listener: (
			this: PrintLinkListElement,
			event: CustomEvent<PrintLinkListUpdateDetail>,
		) => void,
		options?: boolean | AddEventListenerOptions,
	): void;
	addEventListener(
		type: 'print-link-list:error',
		listener: (
			this: PrintLinkListElement,
			event: CustomEvent<PrintLinkListErrorDetail>,
		) => void,
		options?: boolean | AddEventListenerOptions,
	): void;
	addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: boolean | AddEventListenerOptions,
	): void;
}

declare global {
	interface HTMLElementTagNameMap {
		'print-link-list': PrintLinkListElement;
	}
}
