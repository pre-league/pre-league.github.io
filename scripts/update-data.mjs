import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { refreshData } from './refresh.mjs';

const root = new URL('../', import.meta.url);
const config = JSON.parse(await readFile(new URL('data/config.json', root), 'utf8'));
const previous = JSON.parse(await readFile(new URL('data/latest.json', root), 'utf8'));
const now = new Date().toISOString();

async function getJson(path) {
  const response = await fetch(`https://draft.premierleague.com/api/${path}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'PRE-FTW-League/0.1 (public read-only tracker)' },
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`Draft API returned HTTP ${response.status}`);
  return response.json();
}

const result = await refreshData(config, previous, getJson, now);
const refreshed = Object.values(result.divisions).some(division => division.updatedAt === now);
if (refreshed) {
  const date = now.slice(0, 10);
  await mkdir(new URL('data/history/', root), { recursive: true });
  // shortcut: one snapshot per UTC day; use timestamped files if intraday history is needed.
  await writeFile(new URL(`data/history/${date}.json`, root), JSON.stringify({ ...result, history: [] }, null, 2) + '\n');
  result.history = [...new Set([...result.history, date])].sort().reverse();
}
const temporary = new URL('data/latest.json.tmp', root);
await writeFile(temporary, JSON.stringify(result, null, 2) + '\n');
await rename(temporary, new URL('data/latest.json', root));
for (const division of Object.values(result.divisions)) {
  console.log(`${division.name}: ${division.updatedAt === now ? 'updated' : 'retained previous data'}`);
  for (const warning of division.warnings ?? []) console.warn(warning);
}
for (const error of result.errors) console.error(error);
if (result.errors.length) process.exitCode = 1;

await import('./update-players.mjs');
