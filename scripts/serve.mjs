import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, relative, isAbsolute } from 'node:path';
import { generateCrestThumbnails } from './crests.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

export function previewHost(args) {
  return args.includes('--lan') ? '0.0.0.0' : '127.0.0.1';
}

export function resolvePublicPath(rawPath) {
  let path;
  try { path = decodeURIComponent(rawPath); } catch { return null; }
  if (path === '/') path = '/index.html';
  if (path.includes('\\') || path.includes('\0') || path.split('/').includes('..')) return null;
  const allowed = /^\/(index\.html|styles\.css|src\/(app|model|lineup|pages|stats|clubs)\.mjs|assets\/(?:[a-z0-9-]+\.svg|crest\.webp|crest\/thumbs\/[1-9]\d*\.webp|league\/thumbs\/[A-D]\.webp)|data\/(config|latest|community)\.json|data\/history\/\d{4}-\d{2}-\d{2}\.json)$/.test(path);
  if (!allowed) return null;
  const target = resolve(root, `.${path}`);
  const rel = relative(root, target);
  return rel.startsWith('..') || isAbsolute(rel) ? null : target;
}

export function createPreviewServer() {
  return createServer(async (request, response) => {
    const target = resolvePublicPath((request.url ?? '/').split('?')[0]);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return;
    }
    if (!target) { response.writeHead(404); response.end('Not found'); return; }
    try {
      const body = await readFile(target);
      response.writeHead(200, { 'Content-Type': mime[extname(target)] });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch {
      response.writeHead(404); response.end('Not found');
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 4173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
  await generateCrestThumbnails(resolve(root, 'assets'), resolve(root, 'assets'));
  await generateCrestThumbnails();
  await generateCrestThumbnails(resolve(root, 'assets/league'));
  const server = createPreviewServer();
  server.on('error', error => { console.error(`Preview could not start: ${error.code}`); process.exitCode = 1; });
  const host = previewHost(process.argv.slice(2));
  server.listen(port, host, () => {
    console.log(`PRE FTW League → http://127.0.0.1:${port}`);
    if (host === '0.0.0.0') console.log(`LAN preview enabled. On your phone, open http://<your-PC-IP>:${port}/`);
  });
}
