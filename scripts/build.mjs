import { mkdir, readdir, copyFile, readFile, writeFile, access, unlink } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { generateCrestThumbnails } from './crests.mjs';

const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
await generateCrestThumbnails(fileURLToPath(new URL('assets/', root)), fileURLToPath(new URL('assets/', root)));
await generateCrestThumbnails();
await generateCrestThumbnails(fileURLToPath(new URL('assets/league/', root)));
await mkdir(new URL('src/', output), { recursive: true });
for (const path of ['assets/crest/', 'assets/league/']) {
  const directory = new URL(path, output);
  await mkdir(directory, { recursive: true });
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isFile() && /\.png$/i.test(entry.name)) await unlink(new URL(encodeURIComponent(entry.name), directory));
  }
}
await unlink(new URL('assets/crest.png', output)).catch(error => { if (error.code !== 'ENOENT') throw error; });
async function copyDirectory(path) {
  await mkdir(new URL(path, output), { recursive: true });
  for (const entry of await readdir(new URL(path, root), { withFileTypes: true })) {
    if (path === 'assets/' && entry.name === 'crest.png') continue;
    if (['assets/crest/', 'assets/league/'].includes(path) && entry.isFile() && /\.png$/i.test(entry.name)) continue;
    const child = `${path}${entry.name}`;
    if (entry.isDirectory()) await copyDirectory(`${child}/`);
    else if (entry.isFile()) await copyFile(new URL(child, root), new URL(child, output));
    else throw new Error(`Unsupported public asset: ${child}`);
  }
}
for (const path of ['index.html', 'styles.css', 'src/app.mjs', 'src/model.mjs', 'src/lineup.mjs', 'src/pages.mjs', 'src/stats.mjs', 'src/clubs.mjs']) {
  await copyFile(new URL(path, root), new URL(path, output));
}
for (const path of ['assets/', 'data/']) await copyDirectory(path);
await writeFile(new URL('.nojekyll', output), '');
const config = JSON.parse(await readFile(new URL('data/config.json', output), 'utf8'));
const latest = JSON.parse(await readFile(new URL('data/latest.json', output), 'utf8'));
assert.equal(config.name, 'PRE FTW League');
assert.ok(latest.divisions && Array.isArray(latest.history));
for (const path of ['assets/crest/', 'assets/league/']) {
  assert.ok(!(await readdir(new URL(path, output))).some(filename => /\.png$/i.test(filename)), 'Original emblem PNGs must not be deployed');
}
for (const path of ['index.html', 'styles.css', 'src/app.mjs', 'src/model.mjs', 'src/lineup.mjs', 'src/pages.mjs', 'src/stats.mjs', 'src/clubs.mjs', 'data/community.json', 'assets/crest.webp']) {
  await access(new URL(path, output));
}
console.log('Static site built in dist/');
