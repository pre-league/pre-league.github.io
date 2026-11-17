import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function historicalAssets(html) {
  const urls = [...html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(match => match[1].replace(/&amp;/g, '&'));
  const images = [...new Set(urls)].filter(url => url.startsWith('https://sites.google.com/sitesv-images-rt/') && !url.endsWith('=w16383'));
  const sheet = html.match(/https:\/\/docs\.google\.com\/spreadsheets\/d\/([\w-]+)\/htmlembed\?gid=(\d+)/);
  return [...images.map(url => ({ kind: 'image', url })), ...(sheet ? [
    { kind: 'sheet', url: `https://docs.google.com/spreadsheets/d/${sheet[1]}/export?format=csv&gid=${sheet[2]}` },
    { kind: 'workbook', url: `https://docs.google.com/spreadsheets/d/${sheet[1]}/export?format=xlsx` }
  ] : [])];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = new URL('../.tmp-preview/documentation/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('index.json', directory), 'utf8'));
  const history = manifest.pages.find(page => page.url.endsWith('/20252026'));
  if (!history || !/^\d{3}\.html$/.test(history.file)) throw new Error('Run the documentation crawler first.');
  const workbookOnly = process.argv.includes('--workbook');
  const assets = historicalAssets(await readFile(new URL(history.file, directory), 'utf8')).filter(asset => !workbookOnly || asset.kind === 'workbook');
  if (!assets.length) throw new Error('No historical resources found in the captured page.');
  const result = [];
  for (const [index, asset] of assets.entries()) {
    try {
      console.log(`Downloading historical ${asset.kind} ${index + 1}/${assets.length}`);
      const response = await fetch(asset.url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get('content-type') ?? '';
      if (asset.kind === 'image' && !contentType.startsWith('image/')) throw new Error('Expected an image');
      const bytes = Buffer.from(await response.arrayBuffer());
      if (asset.kind === 'sheet' && /^\s*</.test(bytes.toString('utf8'))) throw new Error('Sheet returned HTML rather than CSV');
      if (asset.kind === 'workbook' && (bytes[0] !== 0x50 || bytes[1] !== 0x4b)) throw new Error('Expected an XLSX workbook');
      const extension = asset.kind === 'sheet' ? 'csv' : contentType.includes('webp') ? 'webp' : contentType.includes('jpeg') ? 'jpg' : 'png';
      const file = asset.kind === 'workbook' ? 'history-workbook.xlsx' : `history-${String(index + 1).padStart(2, '0')}.${extension}`;
      await writeFile(new URL(file, directory), bytes);
      result.push({ ...asset, file });
    } catch (error) { result.push({ ...asset, error: error.message }); }
  }
  await writeFile(new URL(workbookOnly ? 'history-workbook-assets.json' : 'history-assets.json', directory), JSON.stringify(result, null, 2) + '\n');
  console.log(`Saved ${result.filter(asset => asset.file).length}/${assets.length} historical resources.`);
  if (result.some(asset => asset.error)) process.exitCode = 1;
}
