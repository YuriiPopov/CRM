import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { sanitizeArticleHtml } from './article-sanitizer';

const SCRIPT = path.resolve(__dirname, '../../../scripts/pack-news-html.mjs');

async function image(
  file: string,
  format: 'png' | 'webp' | 'tiff' | 'jpeg',
  width: number,
  height: number,
) {
  await sharp({
    create: { width, height, channels: 3, background: { r: 90, g: 40, b: 60 } },
  })
    .toFormat(format)
    .toFile(file);
}

function run(htmlPath: string) {
  return spawnSync(process.execPath, [SCRIPT, htmlPath], { encoding: 'utf8' });
}

describe('scripts/pack-news-html.mjs', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'pack-news-'));
    mkdirSync(path.join(dir, 'images', '_excluded_brand'), { recursive: true });
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('inlines img src and CSS url() (jpg, png, webp, tiff with a space in the name), shrinking to 1200 px', async () => {
    await image(path.join(dir, 'images', 'a.png'), 'png', 2400, 1200);
    await image(path.join(dir, 'images', 'b.webp'), 'webp', 300, 200);
    await image(
      path.join(dir, 'images', 'Charcoal Grey.tiff'),
      'tiff',
      1500,
      500,
    );
    await image(path.join(dir, 'images', 'bg.jpg'), 'jpeg', 100, 100);
    writeFileSync(
      path.join(dir, 'article.html'),
      `<article><style>.h{background:url("images/bg.jpg")}</style>
       <img src="images/a.png" alt=""><img src='images/b.webp'>
       <img src="images/Charcoal%20Grey.tiff" alt="">
       <img src="https://example.com/x.png"><a href="#book">x</a>
       <div style="background:url(images/b.webp) center">x</div></article>`,
    );

    const result = run(path.join(dir, 'article.html'));

    expect(result.status).toBe(0);
    const packed = readFileSync(path.join(dir, 'article.packed.html'), 'utf8');
    expect(packed).not.toContain('images/');
    expect(packed).toContain('src="https://example.com/x.png"'); // внешние не трогаем
    const uris = [
      ...packed.matchAll(/data:image\/jpeg;base64,[A-Za-z0-9+/=]+/g),
    ].map((m) => m[0]);
    expect(uris.length).toBeGreaterThanOrEqual(5);
    const widths = await Promise.all(
      uris.map(
        async (u) =>
          (await sharp(Buffer.from(u.split(',')[1], 'base64')).metadata())
            .width,
      ),
    );
    expect(Math.max(...(widths as number[]))).toBe(1200);

    // результат проходит санитайзер backend без ошибок; внешний img он убирает
    const sanitized = await sanitizeArticleHtml(packed);
    expect(sanitized).not.toContain('example.com/x.png');
    expect(sanitized).toContain('href="#book"');
  });

  it('ignores _excluded_brand and does not touch the original', async () => {
    await image(
      path.join(dir, 'images', '_excluded_brand', 'logo.png'),
      'png',
      50,
      50,
    );
    const html = '<p>x</p><img src="images/_excluded_brand/logo.png">';
    writeFileSync(path.join(dir, 'article.html'), html);

    const result = run(path.join(dir, 'article.html'));

    expect(result.status).toBe(0);
    expect(result.stderr).toContain('_excluded_brand');
    expect(readFileSync(path.join(dir, 'article.packed.html'), 'utf8')).toBe(
      html,
    );
    expect(readFileSync(path.join(dir, 'article.html'), 'utf8')).toBe(html);
  });

  it('fails without writing a file when an image is missing', () => {
    writeFileSync(
      path.join(dir, 'article.html'),
      '<img src="images/missing.jpg">',
    );

    const result = run(path.join(dir, 'article.html'));

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('missing.jpg');
    expect(() => readFileSync(path.join(dir, 'article.packed.html'))).toThrow();
  });
});
