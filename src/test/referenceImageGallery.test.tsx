import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ReferenceImageGallery } from '../components/forms/experience/ReferenceImageGallery';

const references = [
  {
    id: 'shirt_design',
    label: 'Desain baju',
    url: 'https://example.com/shirt-design.png',
    alt: 'Panduan desain dan ukuran baju',
  },
];

let container: HTMLDivElement;
let root: Root;

function getButton(label: string) {
  return document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
}

function click(element: HTMLElement) {
  act(() => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}

async function flushUi() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('ReferenceImageGallery', () => {
  it('membuka lightbox, melakukan zoom, lalu menutup dengan Escape', async () => {
    act(() => root.render(<ReferenceImageGallery references={references} />));

    const trigger = getButton('Perbesar Desain baju');
    expect(trigger).not.toBeNull();
    trigger?.focus();
    click(trigger!);
    await flushUi();

    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.textContent).toContain('Zoom 100%');
    expect(document.querySelector('img[alt="Panduan desain dan ukuran baju"]')).not.toBeNull();

    click(getButton('Perbesar gambar menjadi 200%')!);
    expect(document.body.textContent).toContain('Zoom 200%');

    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    await flushUi();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('mengabaikan referensi tanpa URL dan menyediakan kontrol zoom bertahap', async () => {
    act(() => root.render(
      <ReferenceImageGallery
        references={[
          ...references,
          { id: 'empty', label: 'Kosong', url: '  ' },
          { id: 'size_chart', label: 'Size chart', url: 'https://example.com/size-chart.png' },
        ]}
      />,
    ));

    expect(getButton('Perbesar Kosong')).toBeNull();
    click(getButton('Perbesar Size chart')!);
    await flushUi();
    click(getButton('Perbesar gambar')!);

    expect(document.body.textContent).toContain('Zoom 150%');
    click(getButton('Reset zoom')!);
    expect(document.body.textContent).toContain('Zoom 100%');
  });
});
