#!/usr/bin/env node
// Упаковка статьи для новости (item89): <имя>.html → <имя>.packed.html.
//
// Подставляет относительные файлы из <img src="…"> и CSS url(…) (<style> и style="…") как
// data-URI. Каждая картинка пережимается так же, как это делает backend: длинная сторона до 1200 px,
// JPEG q80 (поддерживаются jpg, png, webp, tiff, gif, avif). Папка _excluded_brand игнорируется.
// Внешние (http/https, //) и уже встроенные (data:) ссылки не трогаются.
//
//   node scripts/pack-news-html.mjs ../../Content/2026-10-08_fall_2026_nail_colors.html
//   node scripts/pack-news-html.mjs article.html --out build/article.packed.html

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const MAX_SIDE = 1200;
const JPEG_QUALITY = 80;
const EXCLUDED_DIR = '_excluded_brand';
const MAX_SOURCE_BYTES = 12 * 1024 * 1024; // лимит загрузки в admin-app
const MAX_RESULT_BYTES = 4 * 1024 * 1024; // лимит backend после обработки

function usage() {
  console.error('Użycie: node scripts/pack-news-html.mjs <plik.html> [--out <plik.packed.html>]');
  process.exit(2);
}

const args = process.argv.slice(2);
let input = null;
let outArg = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out') outArg = args[++i];
  else if (args[i] === '-h' || args[i] === '--help') usage();
  else if (!input) input = args[i];
  else usage();
}
if (!input || !input.toLowerCase().endsWith('.html') || input.toLowerCase().endsWith('.packed.html')) usage();

const inputPath = path.resolve(input);
const baseDir = path.dirname(inputPath);
const outPath = outArg
  ? path.resolve(outArg)
  : path.join(baseDir, `${path.basename(inputPath, path.extname(inputPath))}.packed.html`);

const cache = new Map(); // абсолютный путь → Promise<data-URI>
const stats = { packed: 0, bytesBefore: 0, bytesAfter: 0 };
const warnings = [];
const errors = [];

function isLocalRef(ref) {
  const value = ref.trim();
  return (
    value !== '' &&
    !/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value) // http:, https:, data:, file:, //cdn, #якорь
  );
}

function resolveRef(ref) {
  const clean = ref.trim().split(/[?#]/)[0];
  let decoded = clean;
  try {
    decoded = decodeURIComponent(clean);
  } catch {
    // оставляем как есть
  }
  return path.resolve(baseDir, decoded);
}

function isExcluded(absPath) {
  return absPath.split(path.sep).includes(EXCLUDED_DIR);
}

function pack(absPath) {
  if (!cache.has(absPath)) {
    cache.set(
      absPath,
      (async () => {
        const source = await readFile(absPath);
        const out = await sharp(source, { limitInputPixels: 60_000_000 })
          .rotate()
          .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
          .flatten({ background: '#ffffff' })
          .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
          .toBuffer();
        stats.packed++;
        stats.bytesBefore += source.length;
        stats.bytesAfter += out.length;
        return `data:image/jpeg;base64,${out.toString('base64')}`;
      })(),
    );
  }
  return cache.get(absPath);
}

// Подставляет файл вместо ссылки; null — оставить ссылку как есть (с предупреждением/ошибкой)
async function inline(ref, where) {
  if (!isLocalRef(ref)) return null;
  const absPath = resolveRef(ref);
  if (isExcluded(absPath)) {
    warnings.push(`${where}: "${ref}" jest w ${EXCLUDED_DIR}/ — pominięto (backend usunie obrazek)`);
    return null;
  }
  try {
    return await pack(absPath);
  } catch (e) {
    errors.push(`${where}: nie udało się wczytać "${ref}" (${e.code === 'ENOENT' ? 'brak pliku' : e.message})`);
    return null;
  }
}

async function replaceAsync(text, regex, replacer) {
  const matches = [...text.matchAll(regex)];
  const replacements = await Promise.all(matches.map((m) => replacer(m)));
  let result = '';
  let last = 0;
  matches.forEach((m, i) => {
    result += text.slice(last, m.index) + (replacements[i] ?? m[0]);
    last = m.index + m[0].length;
  });
  return result + text.slice(last);
}

// url(…) в CSS: url(a.jpg), url('a.jpg'), url("a.jpg")
const CSS_URL = /url\(\s*(["']?)([^"')]+?)\1\s*\)/gi;
async function packCss(css, where) {
  return replaceAsync(css, CSS_URL, async (m) => {
    const dataUri = await inline(m[2], where);
    return dataUri ? `url(${dataUri})` : null;
  });
}

let html = await readFile(inputPath, 'utf8');

// <img … src="…">
html = await replaceAsync(html, /(<img\b[^>]*?\bsrc\s*=\s*)(?:"([^"]*)"|'([^']*)')/gi, async (m) => {
  const ref = m[2] ?? m[3];
  const dataUri = await inline(ref, '<img>');
  return dataUri ? `${m[1]}"${dataUri}"` : null;
});

// <style> … </style>
html = await replaceAsync(html, /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, async (m) => {
  return `${m[1]}${await packCss(m[2], '<style>')}${m[3]}`;
});

// style="…" / style='…'
html = await replaceAsync(html, /(\bstyle\s*=\s*)(?:"([^"]*)"|'([^']*)')/gi, async (m) => {
  const css = m[2] ?? m[3];
  if (!/url\(/i.test(css)) return null;
  const packed = await packCss(css, 'style=""');
  return `${m[1]}'${packed.replace(/'/g, '&#39;')}'`;
});

for (const w of warnings) console.warn(`⚠ ${w}`);
if (errors.length > 0) {
  for (const e of errors) console.error(`✗ ${e}`);
  console.error('Nie zapisano pliku — popraw ścieżki i uruchom ponownie.');
  process.exit(1);
}

await writeFile(outPath, html, 'utf8');

const size = Buffer.byteLength(html, 'utf8');
const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;
console.log(`✓ ${path.relative(process.cwd(), outPath) || outPath}`);
console.log(`  obrazy: ${stats.packed} (${mb(stats.bytesBefore)} → ${mb(stats.bytesAfter)}), plik: ${mb(size)}`);
if (size > MAX_RESULT_BYTES) {
  console.warn(`⚠ Plik ma ${mb(size)} — backend odrzuci artykuł większy niż 4 MB po przetworzeniu. Zmniejsz liczbę/rozmiar obrazów.`);
}
if (size > MAX_SOURCE_BYTES) {
  console.warn('⚠ Plik przekracza 12 MB — admin-app go nie przyjmie.');
}
