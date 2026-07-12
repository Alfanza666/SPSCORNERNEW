import { describe, expect, it } from 'vitest';
import { richTextToPlainText, sanitizeRichTextHtml } from '../utils/richText';

describe('rich text helpers', () => {
  it('keeps safe formatting while removing unsafe markup', () => {
    const html = '<p><strong>Halo</strong> <img src=x onerror=alert(1)> peserta</p><script>alert(1)</script>';
    const result = sanitizeRichTextHtml(html);

    expect(result).toContain('<p><strong>Halo</strong>  peserta</p>');
    expect(result).not.toContain('<script');
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('<img');
  });

  it('converts formatted descriptions into readable list text', () => {
    const text = richTextToPlainText('<p>Employee Gathering</p><ul><li>RSVP</li><li>QR</li></ul>');

    expect(text).toBe('Employee Gathering RSVP QR');
  });
});
