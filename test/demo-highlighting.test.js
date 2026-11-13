import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
	copyFileSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { describe, expect, it } from 'vitest';

const original = {
	index: [
		'23f0bd2b46f22a76badce8abf70abf819883dfdcadfc269e1a8c5c77d1bb106e',
		'27aeca93762a5bb69468ad2ceb15bd972630466949f3bc5b5bc2d0ae177fb83c',
		'35bd296e18d091fa42b5104ab5c15c9a88b05179e11c14ba50bcfa3d694399a0',
		'98a576bb7003b17404c21562c6c3e124400290796ba6c3bb757ae8d0bc6113ad',
	],
	esm: ['e7cbc65d2151a34bfe3d1837ee8cd198eb973c466074bf9f4af0edb7e17bb9a0'],
	unpkg: ['15ba8b478676ae969c5dba4e5d6a8aa8a7f21339ecbdca37db54327b7cdc9ac3'],
};
const snippets =
	/<\/?print-link-list\b[^>]*>|import\b[\s\S]*?;|customElements\.define\([^)]*\);|definePrintLinkList\(\);|data-print-link-list-ignore|--print-link-list-[\w-]+\s*:[^;]+;|\.styled-list::part\(heading\)/g;
const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
const hash = (text, pkg = manifest) =>
	createHash('sha256')
		.update(
			text.replaceAll(
				`https://esm.sh/${pkg.name}@${pkg.version}/`,
				`https://esm.sh/${pkg.name}@VERSION/`,
			),
		)
		.digest('hex');

describe('displayed component code', () => {
	it('accepts a future version written by the retained publishing helper', () => {
		const fixture = `test/.demo-version-${process.pid}`;
		try {
			mkdirSync(`${fixture}/scripts`, { recursive: true });
			mkdirSync(`${fixture}/demo`);
			const future = { ...manifest, version: '99.12.3' };
			writeFileSync(`${fixture}/package.json`, JSON.stringify(future));
			copyFileSync('demo/esm.html', `${fixture}/demo/esm.html`);
			copyFileSync(
				'scripts/update-demo-versions.js',
				`${fixture}/scripts/update-demo-versions.js`,
			);
			execFileSync(process.execPath, [
				`${fixture}/scripts/update-demo-versions.js`,
			]);
			const html = readFileSync(`${fixture}/demo/esm.html`, 'utf8');
			expect(
				html.split(`${future.name}@${future.version}/`),
			).toHaveLength(3);
			const template = document.createElement('template');
			template.innerHTML = html;
			expect(
				hash(
					template.content.querySelector('pre code').textContent,
					future,
				),
			).toBe(original.esm[0]);
		} finally {
			rmSync(fixture, { recursive: true, force: true });
		}
	});

	it.each(Object.keys(original))(
		'%s marks each component snippet without changing copyable text',
		(name) => {
			const template = document.createElement('template');
			template.innerHTML = readFileSync(`demo/${name}.html`, 'utf8');
			const blocks = [...template.content.querySelectorAll('pre code')];
			expect(blocks).toHaveLength(original[name].length);
			for (const [index, code] of blocks.entries()) {
				expect(hash(code.textContent)).toBe(original[name][index]);
				const expected = [...code.textContent.matchAll(snippets)].map(
					([text]) => text,
				);
				expect(expected.length).toBeGreaterThan(0);
				expect(
					[...code.querySelectorAll('mark')].map(
						(mark) => mark.textContent,
					),
				).toEqual(expected);
				expect(code.querySelector('mark mark')).toBeNull();
				expect(
					code.querySelectorAll(':scope > :not(mark)'),
				).toHaveLength(0);
			}
		},
	);
});
