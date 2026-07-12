const ALLOWED_TAGS = new Set([
  'a',
  'b',
  'blockquote',
  'br',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'i',
  'li',
  'ol',
  'p',
  's',
  'strong',
  'u',
  'ul',
]);

function isSafeHref(value: string): boolean {
  const trimmed = value.trim();
  return /^(https?:|mailto:|tel:|\/|#)/i.test(trimmed);
}

function sanitizeNode(node: Node, documentRef: Document): Node | null {
  if (node.nodeType === Node.TEXT_NODE) return documentRef.createTextNode(node.textContent || '');
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const element = node as HTMLElement;
  const tagName = element.tagName.toLowerCase();
  if (tagName === 'script' || tagName === 'style') return null;

  if (!ALLOWED_TAGS.has(tagName)) {
    const fragment = documentRef.createDocumentFragment();
    element.childNodes.forEach(child => {
      const cleanChild = sanitizeNode(child, documentRef);
      if (cleanChild) fragment.appendChild(cleanChild);
    });
    return fragment;
  }

  const cleanElement = documentRef.createElement(tagName);
  if (tagName === 'a') {
    const href = element.getAttribute('href') || '';
    if (href && isSafeHref(href)) {
      cleanElement.setAttribute('href', href.trim());
      cleanElement.setAttribute('target', '_blank');
      cleanElement.setAttribute('rel', 'noopener noreferrer');
    }
  }

  element.childNodes.forEach(child => {
    const cleanChild = sanitizeNode(child, documentRef);
    if (cleanChild) cleanElement.appendChild(cleanChild);
  });

  return cleanElement;
}

function stripUnsafeMarkupFallback(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

export function sanitizeRichTextHtml(value?: string | null): string {
  const html = String(value || '').trim();
  if (!html) return '';
  if (typeof window === 'undefined' || typeof window.DOMParser === 'undefined') {
    return stripUnsafeMarkupFallback(html);
  }

  const parser = new window.DOMParser();
  const parsed = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const container = parsed.body.firstElementChild || parsed.body;
  const output = document.createElement('div');

  container.childNodes.forEach(child => {
    const cleanChild = sanitizeNode(child, document);
    if (cleanChild) output.appendChild(cleanChild);
  });

  return output.innerHTML;
}

export function richTextToPlainText(value?: string | null): string {
  const html = String(value || '').trim();
  if (!html) return '';
  const normalizedHtml = sanitizeRichTextHtml(html)
    .replace(/<\/?(blockquote|br|div|h[1-4]|li|ol|p|ul)[^>]*>/gi, ' ');

  if (typeof window === 'undefined' || typeof window.DOMParser === 'undefined') {
    return normalizedHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  const parser = new window.DOMParser();
  const parsed = parser.parseFromString(normalizedHtml, 'text/html');
  return (parsed.body.textContent || '').replace(/\s+/g, ' ').trim();
}
