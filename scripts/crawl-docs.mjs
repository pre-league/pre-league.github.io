import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const documentationRoot = 'https://sites.google.com/view/prefantasydraft';
function scopedUrl(href, base) {
  try {
    const url = new URL(href.replace(/&amp;/g, '&'), base);
    const root = new URL(documentationRoot);
    if (url.origin !== root.origin || url.username || url.password || !(url.pathname === root.pathname || url.pathname.startsWith(`${root.pathname}/`))) return null;
    url.search = ''; url.hash = '';
    return url.href.replace(/\/$/, '');
  } catch { return null; }
}

export function discoverPages(html, base) {
  return [...new Set([...html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi)]
    .map(match => scopedUrl(match[1], base)).filter(Boolean))];
}

export async function crawlDocumentation(getPage, savePage) {
  const queue = [documentationRoot, `${documentationRoot}/jornal/10a-jornada`, `${documentationRoot}/hist%C3%B3rico/20252026`];
  const seen = new Set(queue);
  const manifest = { site: documentationRoot, crawledAt: new Date().toISOString(), pages: [], failures: [], complete: false };
  for (let index = 0; index < queue.length && index < 200; index++) {
    const url = queue[index];
    try {
      const html = await getPage(url);
      const file = await savePage(url, html);
      manifest.pages.push({ url, file });
      for (const link of discoverPages(html, url)) {
        if (!seen.has(link)) { seen.add(link); queue.push(link); }
      }
    } catch (error) { manifest.failures.push({ url, error: error.message }); }
  }
  manifest.complete = queue.length <= 200 && manifest.failures.length === 0;
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = new URL('../.tmp-preview/documentation/', import.meta.url);
  await mkdir(directory, { recursive: true });
  let count = 0;
  const manifest = await crawlDocumentation(async url => {
    console.log(`Reading ${url}`);
    const response = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'PRE-FTW-League documentation import' } });
    if (!response.ok || !scopedUrl(response.url, documentationRoot)) throw new Error(`Page inaccessible (HTTP ${response.status})`);
    if (!response.headers.get('content-type')?.includes('text/html')) throw new Error('Expected an HTML page');
    const html = await response.text();
    await new Promise(resolve => setTimeout(resolve, 200));
    return html;
  }, async (url, html) => {
    const filename = `${String(++count).padStart(3, '0')}.html`;
    await writeFile(new URL(filename, directory), html);
    return filename;
  });
  await writeFile(new URL('index.json', directory), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Saved ${manifest.pages.length} pages in .tmp-preview/documentation/; ${manifest.failures.length} failures.`);
  if (!manifest.complete) { console.error('Crawl incomplete. Inspect index.json for inaccessible pages; the crawl limit is 200 pages.'); process.exitCode = 1; }
}
