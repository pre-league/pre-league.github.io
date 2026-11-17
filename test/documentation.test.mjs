import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverPages, crawlDocumentation, documentationRoot } from '../scripts/crawl-docs.mjs';

test('documentation discovery stays inside the published site and removes duplicate fragments', () => {
  const html = `<a href="/view/prefantasydraft/jornal/10a-jornada?authuser=0#stats">GW10</a>
    <a href="${documentationRoot}/jornal/10a-jornada">Again</a><a href="https://sites.google.com/view/another-site">Other site</a>
    <a href="javascript:alert(1)">Invalid</a><a href="https://evil.example/view/prefantasydraft">Other host</a>`;
  assert.deepEqual(discoverPages(html, documentationRoot), [`${documentationRoot}/jornal/10a-jornada`]);
});

test('crawler follows reachable pages once, preserves source HTML and reports inaccessible pages', async () => {
  const saved = [];
  const manifest = await crawlDocumentation(async url => {
    if (url.endsWith('10a-jornada')) throw new Error('Not accessible');
    if (url.endsWith('/history')) return '<h1>History</h1>';
    return `<h1>Welcome</h1><a href="${documentationRoot}/history">History</a>`;
  }, async (url, html) => { saved.push({ url, html }); });
  assert.equal(saved.length, 3);
  assert.ok(saved.some(page => page.html.includes('<h1>History</h1>')));
  assert.equal(manifest.failures.length, 1);
  assert.equal(manifest.complete, false);
});
