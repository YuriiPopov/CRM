import sharp from 'sharp';
import { ArticleException } from './article-errors';
import { isSafeHref, sanitizeArticleHtml } from './article-sanitizer';

async function dataImage(
  format: 'png' | 'webp' | 'jpeg' | 'tiff',
  width: number,
  height: number,
  opts: { alpha?: boolean } = {},
): Promise<string> {
  const buf = await sharp({
    create: {
      width,
      height,
      channels: opts.alpha ? 4 : 3,
      background: opts.alpha
        ? { r: 255, g: 0, b: 0, alpha: 0.5 }
        : { r: 200, g: 50, b: 80 },
    },
  })
    .toFormat(format)
    .toBuffer();
  return `data:image/${format};base64,${buf.toString('base64')}`;
}

async function decode(dataUri: string) {
  const meta = await sharp(
    Buffer.from(dataUri.split(',')[1], 'base64'),
  ).metadata();
  return meta;
}

async function code(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (e) {
    expect(e).toBeInstanceOf(ArticleException);
    return ((e as ArticleException).getResponse() as { code: string }).code;
  }
  return undefined;
}

describe('sanitizeArticleHtml', () => {
  it('removes <script>, inline handlers and javascript: links', async () => {
    const html = await sanitizeArticleHtml(
      `<article><p onclick="alert(1)" class="a" id="x">Hej</p>
       <script>alert(1)</script>
       <a href="javascript:alert(1)">bad</a>
       <a href=" JaVa\tScRiPt:alert(1)">bad2</a>
       <a href="data:text/html,<script>1</script>">bad3</a></article>`,
    );
    expect(html).not.toMatch(/script/i);
    expect(html).not.toMatch(/onclick/i);
    expect(html).not.toMatch(/javascript/i);
    expect(html).not.toMatch(/data:text/i);
    expect(html).toContain('class="a"');
    expect(html).toContain('id="x"');
    expect(html).toContain('Hej');
  });

  it('drops <img onerror> without a data source', async () => {
    const html = await sanitizeArticleHtml(
      '<p>tekst</p><img src="x" onerror="alert(1)"><img src=x onerror=alert(1)>',
    );
    expect(html).not.toMatch(/onerror|<img/i);
  });

  it('removes iframe, object, embed, form, link, meta, base and svg with content', async () => {
    const html = await sanitizeArticleHtml(
      `<meta charset="utf-8"><link rel="stylesheet" href="https://evil/x.css"><base href="https://evil/">
       <div>ok</div>
       <iframe src="https://evil"></iframe><object data="x"></object><embed src="x">
       <form action="https://evil"><input name="a"><button>Wyślij</button></form>
       <svg onload="alert(1)"><script>alert(1)</script><text>SVGTEXT</text></svg>`,
    );
    expect(html).toContain('ok');
    for (const tag of [
      'iframe',
      'object',
      'embed',
      'form',
      'link',
      'meta',
      'base',
      'svg',
      'input',
      'button',
    ]) {
      expect(html).not.toContain(`<${tag}`);
    }
    expect(html).not.toContain('SVGTEXT');
    expect(html).not.toContain('Wyślij');
  });

  it('drops external images but keeps surrounding text', async () => {
    const html = await sanitizeArticleHtml(
      '<p>a</p><img src="https://evil/x.png"><img src="//evil/x.png"><img src="http://evil/x.png"><img src="file:///etc/passwd"><p>b</p>',
    );
    expect(html).toBe('<p>a</p><p>b</p>');
  });

  it('allows only #anchor, https:, tel: and mailto: in href', async () => {
    const html = await sanitizeArticleHtml(
      `<p><a href="#book">1</a><a href="https://example.com/a">2</a><a href="tel:+48123">3</a>
       <a href="mailto:a@b.pl">4</a><a href="http://example.com">5</a><a href="/relative">6</a>
       <a href="vbscript:x">7</a><a href="intent://x">8</a></p>`,
    );
    expect(html).toContain('href="#book"');
    expect(html).toContain('href="https://example.com/a"');
    expect(html).toContain('href="tel:+48123"');
    expect(html).toContain('href="mailto:a@b.pl"');
    expect(html).not.toContain('http://');
    expect(html).not.toContain('"/relative"');
    expect(html).not.toContain('vbscript');
    expect(html).not.toContain('intent:');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('keeps <style>, class, id and inline style', async () => {
    const html = await sanitizeArticleHtml(
      '<style>.a{color:red}@media (prefers-color-scheme:dark){.a{color:#fff}}</style><div class="a" id="b" style="margin:0">x</div>',
    );
    expect(html).toContain('@media (prefers-color-scheme:dark)');
    expect(html).toContain('style="margin:0"');
    expect(html).toContain('class="a"');
  });

  it('neutralises dangerous CSS: @import, external url(), expression, escapes', async () => {
    const html = await sanitizeArticleHtml(
      `<style>@import url("https://evil/x.css");
        .a{background:url(https://evil/x.png);width:expression(alert(1))}
        .b{background:\\75rl(https://evil/y.png)}
        .c{content:"\\3c /style\\3e \\3c script\\3e alert(1)"}
      </style>
      <p style="background:url('//evil/z.png');behavior:url(x)">x</p>`,
    );
    expect(html).not.toMatch(/@import/i);
    expect(html).not.toMatch(/evil/);
    expect(html).not.toMatch(/expression/i);
    expect(html).not.toMatch(/behavior/i);
    // единственный закрывающий </style> — наш собственный
    expect(html.match(/<\/style>/g)).toHaveLength(1);
    expect(html).not.toMatch(/<script/i);
  });

  it('does not let CSS escapes break out of the style element', async () => {
    const html = await sanitizeArticleHtml(
      '<style>.a{content:"\\3c /style\\3e \\3c img src=x onerror=alert(1)\\3e"}</style><p>x</p>',
    );
    expect(html).not.toMatch(/<img/i);
    expect(html.match(/<style>/g)).toHaveLength(1);
  });

  it('survives mutation-XSS vectors via svg/math/noscript/template', async () => {
    const html = await sanitizeArticleHtml(
      `<p>ok</p>
       <svg><style><img src=x onerror=alert(1)></style></svg>
       <math><mtext><table><mglyph><style><!--</style><img title="--&gt;&lt;img src=x onerror=alert(1)&gt;">
       <noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>
       <template><img src=x onerror=alert(1)></template>`,
    );
    expect(html).not.toMatch(/onerror/i);
    expect(html).not.toMatch(/<img/i);
    expect(html).toContain('ok');
  });

  it('unwraps unknown tags but keeps their text, strips comments', async () => {
    const html = await sanitizeArticleHtml(
      '<foo-bar>tekst</foo-bar><!-- comment --><!--[if IE]><script>1</script><![endif]--><p>x</p>',
    );
    expect(html).toBe('tekst<p>x</p>');
  });

  it('rejects HTML that is empty after sanitisation', async () => {
    expect(await code(sanitizeArticleHtml('<script>alert(1)</script>'))).toBe(
      'ARTICLE_INVALID_HTML',
    );
    expect(await code(sanitizeArticleHtml('<div> </div>'))).toBe(
      'ARTICLE_INVALID_HTML',
    );
  });

  describe('images', () => {
    it('recompresses PNG/WebP/TIFF/JPEG to JPEG with the long side ≤ 1200 px', async () => {
      const uris = [
        await dataImage('png', 2400, 1600),
        await dataImage('webp', 1800, 3000),
        await dataImage('tiff', 1300, 100),
        await dataImage('jpeg', 600, 400),
      ];
      const html = await sanitizeArticleHtml(
        uris.map((u) => `<img src="${u}" alt="">`).join(''),
      );
      const out = [...html.matchAll(/src="(data:[^"]+)"/g)].map((m) => m[1]);
      expect(out).toHaveLength(4);
      const metas = await Promise.all(out.map(decode));
      for (const meta of metas) expect(meta.format).toBe('jpeg');
      expect([metas[0].width, metas[0].height]).toEqual([1200, 800]);
      expect([metas[1].width, metas[1].height]).toEqual([720, 1200]);
      expect([metas[2].width, metas[2].height]).toEqual([1200, 92]);
      // маленькие не увеличиваются
      expect([metas[3].width, metas[3].height]).toEqual([600, 400]);
    });

    it('recompresses images inside CSS url() too', async () => {
      const uri = await dataImage('png', 2000, 2000);
      const html = await sanitizeArticleHtml(
        `<style>.h{background:url("${uri}")}</style><div class="h" style="background-image:url('${uri}')">x</div>`,
      );
      const urls = [...html.matchAll(/url\((data:[^)]+)\)/g)].map((m) => m[1]);
      expect(urls).toHaveLength(2);
      for (const u of urls) {
        const meta = await decode(u);
        expect(meta.format).toBe('jpeg');
        expect(meta.width).toBe(1200);
      }
    });

    it('flattens transparency onto white', async () => {
      const uri = await dataImage('png', 40, 40, { alpha: true });
      const html = await sanitizeArticleHtml(`<img src="${uri}">`);
      const out = /src="(data:[^"]+)"/.exec(html)![1];
      const meta = await decode(out);
      expect(meta.hasAlpha).toBe(false);
    });

    it('rejects a corrupt image with ARTICLE_IMAGE_INVALID', async () => {
      const bad = `data:image/png;base64,${Buffer.from('not a picture').toString('base64')}`;
      expect(await code(sanitizeArticleHtml(`<img src="${bad}">`))).toBe(
        'ARTICLE_IMAGE_INVALID',
      );
    });

    it('rejects svg data images', async () => {
      const svg = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>').toString('base64')}`;
      expect(await code(sanitizeArticleHtml(`<img src="${svg}">`))).toBe(
        'ARTICLE_IMAGE_INVALID',
      );
    });
  });
});

describe('isSafeHref', () => {
  it.each([
    ['#shade-1', true],
    ['#book', true],
    ['https://asamazam.com/x', true],
    ['HTTPS://X.pl', true],
    ['tel:+48123456789', true],
    ['mailto:a@b.pl', true],
    ['http://x.pl', false],
    ['javascript:alert(1)', false],
    ['java\nscript:alert(1)', false],
    ['  javascript:alert(1)', false],
    ['data:text/html;base64,AAAA', false],
    ['//evil.com', false],
    ['/path', false],
    ['intent://x#Intent;end', false],
    ['', false],
  ])('%j → %s', (href, expected) => {
    expect(isSafeHref(href)).toBe(expected);
  });
});
