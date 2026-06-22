// Minimal static file server for the Commissioned City Church site.
// Serves the repo root, supports directory index.html and clean dir URLs
// (e.g. "/members/" -> members/index.html). Returns a fast 404 JSON for
// /api/* so the front-end's sermon fetch falls through quickly during tests.

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// repo root is two levels up from tests/ux/
const ROOT = normalize(join(__dirname, '..', '..'));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ics': 'text/calendar',
};

async function resolveFile(urlPath) {
  // strip query/hash
  let p = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  if (p === '/' || p === '') p = '/index.html';
  let full = normalize(join(ROOT, p));
  if (!full.startsWith(ROOT)) return null; // path traversal guard

  try {
    const s = await stat(full);
    if (s.isDirectory()) {
      full = join(full, 'index.html');
      await stat(full);
    }
    return full;
  } catch {
    // try appending .html (clean URL without extension)
    if (!extname(p)) {
      try {
        const alt = normalize(join(ROOT, p + '.html'));
        await stat(alt);
        return alt;
      } catch {}
    }
    return null;
  }
}

export function startServer(port = 0) {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      // Stub API so sermon fetch fails fast and falls to client fallback
      if (req.url.startsWith('/api/')) {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', message: 'stub' }));
        return;
      }
      const file = await resolveFile(req.url);
      if (!file) {
        res.writeHead(404, { 'content-type': 'text/html' });
        res.end('<h1>404 Not Found</h1>');
        return;
      }
      try {
        const data = await readFile(file);
        res.writeHead(200, { 'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream' });
        res.end(data);
      } catch (e) {
        res.writeHead(500);
        res.end('500');
      }
    });
    server.listen(port, '127.0.0.1', () => {
      const actual = server.address().port;
      resolve({ server, port: actual, root: ROOT });
    });
  });
}

// Allow running standalone for manual inspection: `node static-server.mjs 8080`
if (process.argv[1] && import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  const port = Number(process.argv[2]) || 8080;
  startServer(port).then(({ port, root }) => {
    console.log(`Static server: http://127.0.0.1:${port}  (root: ${root})`);
  });
}
