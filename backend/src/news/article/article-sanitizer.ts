import { parseFragment, serialize } from 'parse5';
import type { DefaultTreeAdapterMap } from 'parse5';
import { ArticleException } from './article-errors';
import {
  isDataImage,
  isRasterDataImage,
  recompressDataImage,
} from './article-image';

type Node = DefaultTreeAdapterMap['childNode'];
type Element = DefaultTreeAdapterMap['element'];
type ParentNode = DefaultTreeAdapterMap['parentNode'];

// Теги, которые безопасно оставить. Всё остальное «разворачивается» (остаётся содержимое),
// кроме DROP_WITH_CONTENT — те удаляются вместе с содержимым.
const ALLOWED_TAGS = new Set([
  'a',
  'abbr',
  'article',
  'aside',
  'b',
  'blockquote',
  'br',
  'caption',
  'cite',
  'code',
  'col',
  'colgroup',
  'dd',
  'del',
  'details',
  'div',
  'dl',
  'dt',
  'em',
  'figcaption',
  'figure',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'i',
  'img',
  'ins',
  'li',
  'main',
  'mark',
  'nav',
  'ol',
  'p',
  'pre',
  'q',
  's',
  'section',
  'small',
  'span',
  'strong',
  'style',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'time',
  'tr',
  'u',
  'ul',
]);

const DROP_WITH_CONTENT = new Set([
  'script',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'applet',
  'form',
  'link',
  'meta',
  'base',
  'svg',
  'math',
  'template',
  'noscript',
  'noembed',
  'noframes',
  'title',
  'head',
  'textarea',
  'select',
  'option',
  'input',
  'button',
  'audio',
  'video',
  'source',
  'track',
  'canvas',
  'portal',
  'dialog',
  'slot',
  'map',
  'area',
  'picture',
]);

// Атрибуты любого разрешённого тега; aria-* разбираются отдельно
const GLOBAL_ATTRS = new Set([
  'class',
  'id',
  'style',
  'title',
  'lang',
  'dir',
  'role',
]);
const TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href']),
  img: new Set(['src', 'alt', 'width', 'height', 'loading']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan', 'scope']),
  col: new Set(['span']),
  colgroup: new Set(['span']),
  ol: new Set(['start', 'reversed']),
  time: new Set(['datetime']),
};

// Единственное, что допускается в href: #якорь, https:, tel:, mailto:
const SAFE_HREF_RE = /^(#|https:|tel:|mailto:)/i;

export function isSafeHref(href: string): boolean {
  // Браузер игнорирует управляющие символы и пробелы внутри схемы («java\tscript:»)
  // eslint-disable-next-line no-control-regex
  const compact = href.replace(/[\u0000-\u0020\u007f-\u009f]+/g, '');
  return SAFE_HREF_RE.test(compact);
}

interface ImageJob {
  dataUri: string;
  apply: (value: string) => void;
}

// ---------- CSS ----------

// Нормализация перед проверкой: убираем комментарии и CSS-эскейпы (\75rl( == url(), а также < и NUL —
// иначе «\3c /style» превратился бы в «</style>» и закрыл тег <style>.
function normalizeCss(css: string): string {
  return (
    css
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_m, hex: string) => {
        const cp = parseInt(hex, 16);
        const valid =
          cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff);
        return valid ? String.fromCodePoint(cp) : '\uFFFD';
      })
      .replace(/\\([^\n"'\\])/g, '$1')
      // eslint-disable-next-line no-control-regex
      .replace(/[<\u0000]/g, '')
  );
}

const CSS_URL_RE = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s]*))\s*\)/gi;
const CSS_DANGEROUS_RE =
  /expression\s*\(|javascript\s*:|vbscript\s*:|-moz-binding|behavior\s*:|image-set\s*\(|\bsrc\s*\(/gi;

// CSS → части: строки и ссылки на картинки (data:image/*), которые надо пережать. Любой другой url(…)
// (внешний, относительный, javascript:) заменяется на none; @import удаляется.
function cssParts(css: string): (string | { image: string })[] {
  const clean = normalizeCss(css)
    .replace(/@import[^;]*;?/gi, '')
    .replace(CSS_DANGEROUS_RE, '');
  const parts: (string | { image: string })[] = [];
  let last = 0;
  for (const m of clean.matchAll(CSS_URL_RE)) {
    const value = (m[1] ?? m[2] ?? m[3] ?? '').trim();
    parts.push(clean.slice(last, m.index));
    if (isRasterDataImage(value)) {
      parts.push({ image: value });
    } else {
      parts.push('none');
    }
    last = m.index + m[0].length;
  }
  parts.push(clean.slice(last));
  return parts;
}

// Регистрирует задачи пережатия и возвращает функцию сборки итоговой строки CSS
function prepareCss(css: string, jobs: ImageJob[]): () => string {
  const parts = cssParts(css);
  const resolved = parts.map((p) => (typeof p === 'string' ? p : ''));
  parts.forEach((p, i) => {
    if (typeof p === 'string') return;
    jobs.push({
      dataUri: p.image,
      apply: (value) => {
        resolved[i] = `url(${value})`;
      },
    });
  });
  return () => resolved.join('');
}

// ---------- DOM ----------

function isElement(node: Node): node is Element {
  return 'tagName' in node;
}

function sanitizeChildren(
  parent: ParentNode,
  jobs: ImageJob[],
  finalizers: (() => void)[],
): void {
  const result: Node[] = [];
  for (const child of [...parent.childNodes]) {
    if (!isElement(child)) {
      // Текст оставляем, комментарии/doctype/инструкции (в т.ч. условные комментарии IE) выбрасываем
      if (child.nodeName === '#text') result.push(child);
      continue;
    }
    const tag = child.tagName.toLowerCase();
    if (DROP_WITH_CONTENT.has(tag)) continue;

    sanitizeChildren(child, jobs, finalizers);

    if (!ALLOWED_TAGS.has(tag)) {
      // Неизвестный тег: убираем обёртку, содержимое оставляем
      result.push(...child.childNodes);
      continue;
    }

    if (!sanitizeElement(child, tag, jobs, finalizers)) continue;
    result.push(child);
  }
  for (const node of result)
    (node as { parentNode: ParentNode | null }).parentNode = parent;
  parent.childNodes = result;
}

// false — элемент надо удалить целиком (например, <img> без допустимой картинки)
function sanitizeElement(
  el: Element,
  tag: string,
  jobs: ImageJob[],
  finalizers: (() => void)[],
): boolean {
  const allowedForTag = TAG_ATTRS[tag];
  const attrs: { name: string; value: string }[] = [];
  let src: string | undefined;

  for (const attr of el.attrs) {
    const name = attr.name.toLowerCase();
    // on* (onerror, onclick…) и всё неизвестное отбрасываем
    if (name === 'src' && tag === 'img') {
      src = attr.value;
      continue;
    }
    if (name === 'style') {
      const build = prepareCss(attr.value, jobs);
      const out = { name, value: '' };
      attrs.push(out);
      finalizers.push(() => {
        out.value = build();
      });
      continue;
    }
    if (name === 'href' && tag === 'a') {
      if (isSafeHref(attr.value))
        attrs.push({ name, value: attr.value.trim() });
      continue;
    }
    if (
      GLOBAL_ATTRS.has(name) ||
      name.startsWith('aria-') ||
      allowedForTag?.has(name)
    ) {
      if (!name.startsWith('on')) attrs.push({ name, value: attr.value });
    }
  }

  if (tag === 'img') {
    if (src === undefined || !isDataImage(src)) return false; // внешние URL убираем вместе с <img>
    if (!isRasterDataImage(src)) {
      throw new ArticleException(
        'ARTICLE_IMAGE_INVALID',
        'Article contains an unsupported inline image (only PNG, JPEG, WebP, GIF, AVIF, TIFF are allowed)',
      );
    }
    const out = { name: 'src', value: '' };
    attrs.push(out);
    jobs.push({
      dataUri: src,
      apply: (value) => {
        out.value = value;
      },
    });
  }

  if (tag === 'a') {
    if (attrs.some((a) => a.name === 'href')) {
      attrs.push({ name: 'rel', value: 'noopener noreferrer' });
    }
  }

  if (tag === 'style') {
    // <style>: единственный потомок — текст; перерабатываем как CSS
    const text = el.childNodes
      .filter((n) => n.nodeName === '#text')
      .map((n) => (n as DefaultTreeAdapterMap['textNode']).value)
      .join('');
    const build = prepareCss(text, jobs);
    const textNode: DefaultTreeAdapterMap['textNode'] = {
      nodeName: '#text',
      value: '',
      parentNode: el,
    };
    el.childNodes = [textNode];
    finalizers.push(() => {
      textNode.value = build();
    });
  }

  el.attrs = attrs;
  return true;
}

// Пережатие с небольшим параллелизмом и дедупликацией одинаковых data-URI
async function recompressAll(jobs: ImageJob[]): Promise<void> {
  const cache = new Map<string, Promise<string>>();
  const unique = [...new Set(jobs.map((j) => j.dataUri))];
  const results = new Map<string, string>();
  const BATCH = 4;
  for (let i = 0; i < unique.length; i += BATCH) {
    await Promise.all(
      unique.slice(i, i + BATCH).map(async (uri) => {
        let pending = cache.get(uri);
        if (!pending) {
          pending = recompressDataImage(uri);
          cache.set(uri, pending);
        }
        results.set(uri, await pending);
      }),
    );
  }
  for (const job of jobs) job.apply(results.get(job.dataUri) as string);
}

function hasContent(root: ParentNode): boolean {
  for (const node of root.childNodes) {
    if (node.nodeName === '#text') {
      if ((node as DefaultTreeAdapterMap['textNode']).value.trim() !== '')
        return true;
    } else if (isElement(node)) {
      if (node.tagName === 'img' || node.tagName === 'hr') return true;
      if (node.tagName !== 'style' && hasContent(node)) return true;
    }
  }
  return false;
}

// Белый список: убирает активное содержимое и внешние ресурсы, пережимает все data:image/*
// (JPEG q80, длинная сторона ≤ 1200 px) и возвращает безопасный HTML-фрагмент.
export async function sanitizeArticleHtml(raw: string): Promise<string> {
  const fragment = parseFragment(raw);
  const jobs: ImageJob[] = [];
  const finalizers: (() => void)[] = [];

  sanitizeChildren(fragment, jobs, finalizers);
  await recompressAll(jobs);
  finalizers.forEach((f) => f());

  if (!hasContent(fragment)) {
    throw new ArticleException(
      'ARTICLE_INVALID_HTML',
      'Article HTML is empty after removing unsupported content',
    );
  }
  return serialize(fragment);
}
