import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const types = {
	'.css': 'text/css',
	'.html': 'text/html',
	'.js': 'text/javascript',
	'.json': 'application/json',
};

createServer(async (request, response) => {
	try {
		const pathname = decodeURIComponent(
			new URL(request.url, 'http://localhost').pathname,
		);
		const path = resolve(root, `.${pathname}`);
		if (
			!path.startsWith(`${resolve(root)}${sep}`) ||
			pathname.split('/').some((part) => part.startsWith('.'))
		) {
			response.writeHead(403).end();
			return;
		}
		const file = await stat(path);
		if (!file.isFile()) {
			response.writeHead(404).end();
			return;
		}
		response.writeHead(200, {
			'content-type': types[extname(path)] || 'application/octet-stream',
			'cache-control': 'no-store',
			'content-length': file.size,
		});
		if (request.method === 'HEAD') response.end();
		else
			createReadStream(path)
				.on('error', () => response.destroy())
				.pipe(response);
	} catch (error) {
		response.writeHead(error.code === 'ENOENT' ? 404 : 400).end();
	}
}).listen(Number(process.env.PORT || 4193), '127.0.0.1');
