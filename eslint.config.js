import eslintConfig from '@open-wc/eslint-config';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
	...eslintConfig,
	eslintConfigPrettier,
	{
		ignores: ['node_modules/**', 'coverage/**', 'demo/**'],
	},
	{
		files: [
			'scripts/serve.js',
			'test/browser/**/*.js',
			'playwright.config.js',
		],
		rules: {
			'no-undef': 'off',
		},
	},
];
