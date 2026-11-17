import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePublicPath, previewHost } from '../scripts/serve.mjs';

test('LAN preview listens on network interfaces only when requested', () => {
  assert.equal(previewHost([]), '127.0.0.1');
  assert.equal(previewHost(['--lan']), '0.0.0.0');
});

test('preview serves only public assets, including nested Pages-compatible data', () => {
  for (const path of ['/', '/styles.css', '/src/app.mjs', '/src/lineup.mjs', '/src/pages.mjs', '/src/stats.mjs', '/assets/crest/thumbs/15016.webp', '/data/latest.json', '/data/community.json', '/data/history/2026-11-17.json']) {
    assert.ok(resolvePublicPath(path), path);
  }
});

test('preview rejects secrets, source tooling, traversal and invalid URL encodings', () => {
  for (const path of ['/.git/config', '/.env', '/scripts/serve.mjs', '/../README.md', '/data/%2e%2e/.env', '/data/%5c..%5c.env', '/%ZZ', '/assets/x.svg%00', '/assets/crest/../../.env', '/assets/crest/not-a-team.png', '/assets/crest/thumbs/../../.env', '/assets/crest/thumbs/x.webp']) {
    assert.equal(resolvePublicPath(path), null, path);
  }
});

test('preview exposes optimized league emblems only for divisions A to D', () => {
  for (const key of ['A', 'B', 'C', 'D']) assert.ok(resolvePublicPath(`/assets/league/thumbs/${key}.webp`));
  for (const path of ['/assets/league/A.png', '/assets/league/thumbs/E.webp', '/assets/league/thumbs/../A.png']) assert.equal(resolvePublicPath(path), null);
});

test('preview exposes the optimized competition crest without the original PNG', () => {
  assert.ok(resolvePublicPath('/assets/crest.webp'));
  assert.equal(resolvePublicPath('/assets/crest.png'), null);
});

test('club module is public but source tooling remains private', () => {
  assert.ok(resolvePublicPath('/src/clubs.mjs'));
  assert.equal(resolvePublicPath('/scripts/clubs.mjs'), null);
});
