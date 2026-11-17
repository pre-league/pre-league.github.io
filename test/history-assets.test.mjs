import test from 'node:test';
import assert from 'node:assert/strict';
import { historicalAssets } from '../scripts/capture-history.mjs';

test('captures historical table images and the linked sheet, excluding decorative and unrelated images', () => {
  const assets = historicalAssets('<img src="https://sites.google.com/sitesv-images-rt/header=w16383"><img src="https://sites.google.com/sitesv-images-rt/table=w1280"><img src="https://evil.example/image.png"><a href="https://docs.google.com/spreadsheets/d/abc123/htmlembed?gid=123">Sheet</a>');
  assert.equal(assets.length, 3);
  assert.equal(assets[0].kind, 'image');
  assert.equal(assets[1].url, 'https://docs.google.com/spreadsheets/d/abc123/export?format=csv&gid=123');
  assert.equal(assets[2].kind, 'workbook');
  assert.equal(assets[2].url, 'https://docs.google.com/spreadsheets/d/abc123/export?format=xlsx');
});
