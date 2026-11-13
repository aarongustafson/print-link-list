import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

const read = (path) =>
	readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
const source = await read('print-link-list.js');
const definition = await read('define.js');
const css = await read('demo/styles.css');
const tokens = [
	'Canvas',
	'CanvasText',
	'ButtonFace',
	'ButtonText',
	'Field',
	'FieldText',
];
// The study's 62 observations reduce to 19 distinct palettes; this is not OS repaint testing.
const palettes = [
	['#ffffff', '#000000', '#efefef', '#000000', '#ffffff', '#000000'],
	['#121212', '#ffffff', '#6b6b6b', '#ffffff', '#3b3b3b', '#ffffff'],
	['#ffffff', '#000000', '#e9e9ed', '#000000', '#ffffff', '#000000'],
	['#1c1b22', '#fbfbfe', '#2b2a33', '#fbfbfe', '#2b2a33', '#fbfbfe'],
	['#ffffff', '#000000', '#c0c0c0', '#000000d8', '#ffffff', '#000000d8'],
	['#1e1e1e', '#ffffff', '#ffffff3f', '#ffffffd8', '#ffffff3f', '#ffffffd8'],
	['#ffffff', '#000000', '#f0f0f0', '#000000', '#ffffff', '#000000'],
	['#202020', '#ffffff', '#202020', '#ffffff', '#202020', '#ffffff'],
	['#fffaef', '#3d3d3d', '#fffaef', '#202020', '#fffaef', '#3d3d3d'],
	['#2d3236', '#ffffff', '#2d3236', '#b6f6f0', '#2d3236', '#ffffff'],
	['#000000', '#ffffff', '#000000', '#ffee32', '#000000', '#ffffff'],
	['#000000', '#ffffff', '#000000', '#ffee32', '#000000', '#ffee32'],
	['#2d3236', '#ffffff', '#2d3236', '#b6f6f0', '#2d3236', '#b6f6f0'],
	['#fffaef', '#3d3d3d', '#fffaef', '#202020', '#fffaef', '#202020'],
	['#ffffff', '#000000', '#c0c0c0', '#000000', '#ffffff', '#000000'],
	['#000000', '#ffffff', '#c0c0c0', '#000000', '#ffffff', '#000000'],
	['#ffffff', '#000000', '#ffffff', '#000000d8', '#ffffff', '#000000d8'],
	['#282828', '#ffffff', '#202020', '#ffffff', '#202020', '#ffffff'],
	['#202020', '#ffffff', '#00000000', '#ffffff', '#00000000', '#ffffff'],
];

function substitute(text, palette) {
	const colors = Object.fromEntries(
		tokens.map((token, index) => [token.toLowerCase(), palette[index]]),
	);
	return text.replace(
		/\b(CanvasText|Canvas|ButtonFace|ButtonText|FieldText|Field)\b/gi,
		(token) => colors[token.toLowerCase()],
	);
}

async function contrast(locator, property = 'color') {
	return locator.evaluate((element, colorProperty) => {
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = 1;
		const context = canvas.getContext('2d', { willReadFrequently: true });
		const paint = (color) => {
			context.fillStyle = color;
			context.fillRect(0, 0, 1, 1);
			return [...context.getImageData(0, 0, 1, 1).data];
		};
		const ancestors = [];
		for (let node = element; node; node = node.parentElement)
			ancestors.unshift(node);
		let background;
		for (const node of ancestors)
			background = paint(getComputedStyle(node).backgroundColor);
		if (background[3] !== 255)
			throw new Error('Expected opaque background');
		const foreground = paint(getComputedStyle(element)[colorProperty]);
		const luminance = (rgb) =>
			rgb.slice(0, 3).reduce((sum, channel, index) => {
				const value = channel / 255;
				return (
					sum +
					(value <= 0.04045
						? value / 12.92
						: ((value + 0.055) / 1.055) ** 2.4) *
						[0.2126, 0.7152, 0.0722][index]
				);
			}, 0);
		const values = [luminance(background), luminance(foreground)].sort(
			(a, b) => b - a,
		);
		return (values[0] + 0.05) / (values[1] + 0.05);
	}, property);
}

async function demo(page, name = 'index.html') {
	await page.route('https://esm.sh/**', (route) =>
		route.fulfill({ contentType: 'text/javascript', body: source }),
	);
	await page.route('https://unpkg.com/**', (route) =>
		route.fulfill({
			contentType: 'text/javascript',
			body: definition.replace(
				"'./print-link-list.js'",
				"'http://127.0.0.1:4193/print-link-list.js'",
			),
		}),
	);
	await page.goto(`/demo/${name}`);
	await page.waitForFunction(() => !!customElements.get('print-link-list'));
}

test('reading surfaces and supporting text retain contrast across study palettes', async ({
	page,
}) => {
	await demo(page);
	const style = await page.addStyleTag({ content: css });
	for (const palette of palettes) {
		await style.evaluate(
			(node, text) => {
				node.textContent = text;
			},
			substitute(css, palette),
		);
		for (const selector of [
			'body',
			'.demo-section',
			'.demo-section > p',
			'.demo',
			'pre',
			'footer',
			'.actions button',
			'output',
		]) {
			expect(
				await contrast(page.locator(selector).first()),
				`${selector}: ${palette}`,
			).toBeGreaterThanOrEqual(4.5);
		}
		expect(
			await contrast(
				page.locator('.actions button').first(),
				'borderTopColor',
			),
		).toBeGreaterThanOrEqual(3);
		await page.locator('.actions button').first().hover();
		expect(
			await contrast(page.locator('.actions button').first()),
		).toBeGreaterThanOrEqual(4.5);
	}
});

for (const name of ['index.html', 'esm.html', 'unpkg.html']) {
	for (const colorScheme of ['light', 'dark']) {
		test(`${name} ${colorScheme}: reading surfaces retain text contrast in the actual browser`, async ({
			page,
		}) => {
			await page.emulateMedia({ colorScheme });
			await demo(page, name);
			for (const selector of [
				'body',
				'.demo-section',
				'.demo',
				'footer',
			]) {
				expect(
					await contrast(page.locator(selector).first()),
					selector,
				).toBeGreaterThanOrEqual(4.5);
			}
		});

		test(`${name} ${colorScheme}: native keyboard focus, reflow, and print`, async ({
			page,
			browserName,
		}) => {
			await page.emulateMedia({ colorScheme });
			await demo(page, name);
			await page.keyboard.press(
				browserName === 'webkit' && process.platform === 'darwin'
					? 'Alt+Tab'
					: 'Tab',
			);
			await expect(page.locator(':focus')).toBeVisible();
			const link = page.locator('a').first();
			await link.focus();
			const native = await link.evaluate((node) => {
				const result = {
					style: getComputedStyle(node).outlineStyle,
					width: getComputedStyle(node).outlineWidth,
				};
				const probe = document.createElement('a');
				probe.href = '#';
				probe.textContent = 'Native focus probe';
				document.body.append(probe);
				probe.style.all = 'revert';
				probe.focus();
				const reference = {
					style: getComputedStyle(probe).outlineStyle,
					width: getComputedStyle(probe).outlineWidth,
				};
				probe.remove();
				return { result, reference };
			});
			expect(native.result).toEqual(native.reference);
			await page.setViewportSize({ width: 320, height: 800 });
			expect(
				await page.evaluate(() => document.documentElement.scrollWidth),
			).toBeLessThanOrEqual(320);
			await expect(page.locator('print-link-list').first()).toBeHidden();
			await page.emulateMedia({ media: 'print' });
			await expect(page.locator('print-link-list').first()).toBeVisible();
			await expect(
				page
					.locator('print-link-list')
					.first()
					.locator('[part="destination"]')
					.first(),
			).toHaveCSS('color', 'rgb(0, 0, 0)');
			await expect(page.locator('body')).toHaveCSS(
				'background-color',
				'rgb(255, 255, 255)',
			);
			await expect(page.locator('pre').first()).toBeHidden();
		});
	}
}

test('dynamic updates retain focus, deduplicate destinations, and expose an authored count', async ({
	page,
}) => {
	await demo(page);
	const button = page.getByRole('button', { name: 'Add another link' });
	await button.focus();
	await page.keyboard.press('Enter');
	await expect(page.locator('#added-count')).toHaveText('1');
	await expect(button).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(page.locator('#added-count')).toHaveText('2');
	await expect(page.locator('#dynamic-example [part="item"]')).toHaveCount(2);
	await expect(
		page.locator('#dynamic-example .dynamic-content p'),
	).toHaveCount(3);
});

test('wide examples put code before live content; print output is independently black on white', async ({
	page,
	browserName,
}, testInfo) => {
	await demo(page);
	await page.setViewportSize({ width: 1280, height: 900 });
	const code = await page
		.locator('.code-demo-pair pre')
		.first()
		.boundingBox();
	const live = await page
		.locator('.code-demo-pair .demo')
		.first()
		.boundingBox();
	expect(code.x + code.width).toBeLessThanOrEqual(live.x);
	await page.screenshot({
		path: testInfo.outputPath('screen.png'),
		fullPage: true,
	});
	await page.emulateMedia({ colorScheme: 'dark', media: 'print' });
	await expect(page.locator('[part="heading"]').first()).toHaveText('Links');
	await expect(
		page.locator('#localized-example [part="heading"]'),
	).toHaveText('Referencias');
	await expect(page.locator('#default-example [part="item"]')).toHaveCount(2);
	await expect(
		page.locator('#default-example [data-print-link-list-marker]').first(),
	).toBeVisible();
	await expect(page.locator('[data-print]').first()).toBeHidden();
	await page.screenshot({
		path: testInfo.outputPath('print.png'),
		fullPage: true,
	});
	if (browserName === 'chromium') {
		const pdf = await page.pdf({
			path: testInfo.outputPath('output.pdf'),
			format: 'A4',
			printBackground: true,
		});
		expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
		expect(pdf.byteLength).toBeGreaterThan(10000);
	}
});

for (const colorScheme of ['light', 'dark']) {
	test(`${colorScheme}: actual native pairs measured separately from recorded palettes`, async ({
		page,
		browserName,
	}) => {
		test.fail(
			process.platform === 'linux' &&
				browserName === 'webkit' &&
				colorScheme === 'dark',
			'Bundled Ubuntu WebKit dark ButtonText/ButtonFace is a known 1.82:1 native-pair limitation outside the study.',
		);
		await page.emulateMedia({ colorScheme });
		await demo(page);
		for (const selector of ['pre', '.actions button']) {
			expect(
				await contrast(page.locator(selector).first()),
				selector,
			).toBeGreaterThanOrEqual(4.5);
		}
	});
}

for (const forcedColors of ['active', 'none']) {
	test(`${forcedColors}: native forced-color adjustment retains reading surfaces and controls`, async ({
		page,
	}) => {
		await page.emulateMedia({ forcedColors, contrast: 'more' });
		await demo(page);
		const supportsAdjustment = await page.evaluate(() =>
			CSS.supports('forced-color-adjust', 'auto'),
		);
		test.skip(
			forcedColors === 'active' && !supportsAdjustment,
			'This engine does not support forced-color adjustment; recorded-palette coverage is separate.',
		);
		for (const selector of ['body', '.demo', '.actions button', 'footer']) {
			expect(
				await contrast(page.locator(selector).first()),
				selector,
			).toBeGreaterThanOrEqual(4.5);
			await expect(page.locator(selector).first()).toHaveCSS(
				'forced-color-adjust',
				supportsAdjustment ? 'auto' : '',
			);
		}
	});
}

test('print buttons invoke the native print command without replacing content', async ({
	page,
}) => {
	await demo(page);
	await page.evaluate(() => {
		window.printCalls = 0;
		window.print = () => {
			window.printCalls += 1;
		};
	});
	await page
		.getByRole('button', { name: 'Open print dialog' })
		.first()
		.click();
	expect(await page.evaluate(() => window.printCalls)).toBe(1);
	await expect(page.locator('#default-example a').first()).toBeVisible();
});

for (const name of ['index.html', 'esm.html', 'unpkg.html']) {
	test(`${name}: no JavaScript and failed modules preserve native links and print instructions`, async ({
		browser,
		page,
	}) => {
		const context = await browser.newContext({ javaScriptEnabled: false });
		const native = await context.newPage();
		await native.goto(`/demo/${name}`);
		await expect(
			native.getByText('Use your browser’s Print command', {
				exact: false,
			}),
		).toBeVisible();
		await expect(native.locator('.demo a').first()).toBeVisible();
		if (name === 'index.html')
			await expect(native.locator('.actions').first()).toBeHidden();
		await native.emulateMedia({ media: 'print' });
		await expect(native.locator('.demo a').first()).toBeVisible();
		await context.close();
		await page.route('**/*', (route) =>
			route.request().resourceType() === 'script'
				? route.abort()
				: route.continue(),
		);
		await page.goto(`/demo/${name}`);
		await expect(page.locator('.demo a').first()).toBeVisible();
		await expect(
			page.getByText('Use your browser’s Print command', {
				exact: false,
			}),
		).toBeVisible();
	});
}
