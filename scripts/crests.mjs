import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);

export async function generateCrestThumbnails(
  sourceDirectory = fileURLToPath(new URL('../assets/crest/', import.meta.url)),
  outputDirectory = join(sourceDirectory, 'thumbs')
) {
  await mkdir(sourceDirectory, { recursive: true });
  await mkdir(outputDirectory, { recursive: true });
  const originals = (await readdir(sourceDirectory, { withFileTypes: true }))
    .filter(entry => entry.isFile() && /^(?:[1-9]\d*|[A-D]|crest)\.png$/.test(entry.name));
  const generated = new Set();
  for (const { name } of originals) {
    const input = join(sourceDirectory, name);
    const filename = name.replace(/\.png$/, '.webp');
    const output = join(outputDirectory, filename);
    try {
      await run('ffmpeg', [
        '-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', input,
        '-frames:v', '1', '-vf', 'scale=192:192:force_original_aspect_ratio=decrease:flags=lanczos',
        '-c:v', 'libwebp', '-quality', '85', '-compression_level', '6', '-pix_fmt', 'bgra', output
      ], { windowsHide: true, timeout: 30000 });
    } catch (error) {
      if (error.code === 'ENOENT') throw new Error('FFmpeg is required for crest thumbnails. Install ffmpeg and add it to PATH.');
      throw error;
    }
    generated.add(filename);
    console.log(`Crest ${name}: ${(await stat(input)).size} → ${(await stat(output)).size} bytes`);
  }
  for (const filename of await readdir(outputDirectory)) {
    if (/^(?:[1-9]\d*|[A-D]|crest)\.webp$/.test(filename) && !generated.has(filename)) await unlink(join(outputDirectory, filename));
  }
}
