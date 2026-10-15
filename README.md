# `<print-link-list>`

[![npm version](https://img.shields.io/npm/v/@aarongustafson/print-link-list.svg)](https://www.npmjs.com/package/@aarongustafson/print-link-list) [![Build Status](https://img.shields.io/github/actions/workflow/status/aarongustafson/print-link-list/ci.yml?branch=main)](https://github.com/aarongustafson/print-link-list/actions)

`<print-link-list>` generates a numbered, deduplicated list of links and citations for printed web pages. It is a modern Web Component interpretation of [“Improving Link Display for Print”](https://alistapart.com/article/improvingprint/).

The component leaves source content intact, inserts markers that appear only in print, and renders the corresponding destination list where the component is placed.

## Demo

[Live Demo](https://aarongustafson.github.io/print-link-list/demo/) ([source](./demo/index.html))

## Installation

```bash
npm install @aarongustafson/print-link-list
```

Import the package to define `<print-link-list>` automatically:

```js
import '@aarongustafson/print-link-list';
```

Or control registration yourself:

```js
import {
	PrintLinkListElement,
	definePrintLinkList,
} from '@aarongustafson/print-link-list';

definePrintLinkList();
```

To register the class under another valid custom-element name, import the
side-effect-free implementation directly:

```js
import { PrintLinkListElement } from '@aarongustafson/print-link-list/print-link-list.js';

customElements.define('my-print-links', PrintLinkListElement);
```

## Basic usage

By default, the component inspects the first `<main>` element.

```html
<main>
	<p>
		Read the
		<a href="https://example.com/guide">complete guide</a>.
	</p>
</main>

<print-link-list></print-link-list>
```

In print, the link receives a superscript marker and the component becomes:

```text
Links
1. https://example.com/guide
```

Place the component wherever the destination list should appear in the printed document.

### Custom target and heading

`target` accepts any valid CSS selector and uses its first match.

```html
<article class="printable">
	<!-- Content -->
</article>

<print-link-list
	target="article.printable"
	heading="References"
	label-source="Source"
></print-link-list>
```

An invalid or unmatched selector does not throw. It dispatches `print-link-list:error` and logs a warning prefixed with `<print-link-list> - `.

## Reference rules

The component:

- includes HTTP and HTTPS anchor destinations;
- includes HTTP and HTTPS values from `cite` attributes;
- prefixes citation markers with a translatable `Source` label;
- resolves relative destinations against the document base URL;
- deduplicates destinations while preserving first-occurrence order;
- reuses the same number for repeated destinations;
- ignores same-document fragment links, `javascript:` URLs, unsupported schemes, and empty or malformed values;
- ignores links and citations inside the component itself;
- turns `mailto:` links into email addresses without query parameters;
- turns `tel:` links into telephone numbers without the scheme; and
- includes `mailto:`, `tel:`, and download destinations only when the visible link text does not already communicate the destination.

### Opting out

Add `data-print-link-list-ignore` to a reference or any ancestor subtree:

```html
<nav data-print-link-list-ignore>
	<a href="/account">Account</a>
</nav>
```

## Dynamic content

The component observes its target. Added, removed, or changed links and citations automatically produce an updated, correctly numbered list. Updates are batched to one rebuild per animation frame.

Call `refresh()` to request an immediate rebuild:

```js
const list = document.querySelector('print-link-list');
const processed = list.refresh();
```

`refresh()` returns `true` when its target was found and processed, or `false` after a target error.

## Attributes and properties

| Attribute | Property | Default | Description |
| --- | --- | --- | --- |
| `target` | `target` | `main` | Selector for the first content element to inspect |
| `heading` | `heading` | `Links` | Heading above the printed destination list |
| `label-source` | `labelSource` | `Source` | Label before each citation superscript |

Setting any property to `null` or `undefined` removes its attribute and restores the default.

Translate the citation label directly in markup:

```html
<print-link-list label-source="Quelle"></print-link-list>
```

## Events

Both events bubble and cross shadow boundaries.

### `print-link-list:update`

Fires after a successful rebuild:

```js
list.addEventListener('print-link-list:update', (event) => {
	console.log(event.detail);
	// { destinations: 3, references: 5 }
});
```

### `print-link-list:error`

Fires when `target` is invalid or has no match:

```js
list.addEventListener('print-link-list:error', (event) => {
	console.log(event.detail);
	// {
	//   type: "target-not-found",
	//   selector: ".missing",
	//   message: "The target selector \".missing\" did not match an element."
	// }
});
```

`type` is either `invalid-target` or `target-not-found`.

## Styling

The component has an open shadow root. Its list can be styled with parts:

```css
print-link-list::part(heading) {
	font-family: sans-serif;
}

print-link-list::part(list) {
	font-size: 9pt;
}

print-link-list::part(item) {
	margin-block: 0.25em;
}

print-link-list::part(destination) {
	text-decoration: underline;
}
```

Available custom properties:

| Property | Default | Description |
| --- | --- | --- |
| `--print-link-list-marker-gap` | `0.15em` | Space before a printed reference marker |
| `--print-link-list-marker-font-size` | `0.75em` | Printed reference marker size |
| `--print-link-list-margin` | `2rem` | Space before the printed destination list |

Markers and the component are hidden on screen by default. Author styles can override these defaults if a screen preview is needed.

## Accessibility

- Existing link text, semantics, and focus behavior are unchanged.
- Generated markers are `aria-hidden` and hidden outside print.
- The destination list exists in the component's open shadow root and is hidden outside print.
- The component does not add keyboard interactions or alter link destinations.
- Removing the component removes only the markers owned by that instance.

## Progressive enhancement and no-JavaScript fallback

Without JavaScript, the source document remains readable, but a deduplicated list cannot be generated. A print stylesheet can provide the simpler inline-URL fallback from the original technique:

```css
@media print {
	a[href^='http']::after {
		content: ' (' attr(href) ')';
		font-size: 90%;
	}
}
```

Only use that fallback when the component script is unavailable; otherwise it duplicates destinations. An application can add its own root class before loading modules if it needs to switch between fallback and enhanced styles.

## Browser support

The component requires:

- Custom Elements v1
- Shadow DOM v1
- ES modules
- `MutationObserver`

It is tested in a DOM environment and should be checked in real browser print preview because pagination and print rendering cannot be fully simulated by DOM unit tests.

## Development

```bash
npm install
npm run test:run
npm run lint
```

## License

MIT © [Aaron Gustafson](https://www.aaron-gustafson.com/)
