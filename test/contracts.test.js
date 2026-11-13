import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path) => readFile(resolve(process.cwd(), path), 'utf8');

describe('demo and publishing contracts', () => {
	it('retains the version update, staging, and push automation', async () => {
		const manifest = JSON.parse(await read('package.json'));
		expect(manifest.scripts.version).toBe(
			'node scripts/update-demo-versions.js && git add demo/esm.html',
		);
		expect(manifest.scripts.postversion).toBe('git push --follow-tags');
		const esm = await read('demo/esm.html');
		expect(esm.split(`${manifest.name}@${manifest.version}/`)).toHaveLength(
			3,
		);
	});

	it('keeps printed generated links inherited without changing native printing', async () => {
		const runtime = await read('print-link-list.js');
		expect(runtime).toMatch(/a\s*\{\s*color: inherit;/);
		expect(runtime).not.toContain('forced-color-adjust: none');
		expect(runtime).not.toContain('window.print =');
	});

	it('keeps shared prose pairs and native focus without blanket forced-color fills', async () => {
		const css = await read('demo/styles.css');
		expect(css).not.toMatch(
			/GrayText|ActiveText|SelectedItem|AccentColor|Highlight/,
		);
		expect(css).not.toContain(':focus-visible');
		expect(css).not.toContain('forced-color-adjust: none');
	});
});
