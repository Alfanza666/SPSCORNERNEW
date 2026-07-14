import { Dialog } from '@headlessui/react';
import { Maximize2, Minus, Plus, RotateCcw, X, ZoomIn } from 'lucide-react';
import { useState } from 'react';
import type { FormReferenceImage } from '../../../types/form';
import { cx } from './utils';

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.5;

export interface ReferenceImageGalleryProps {
  references?: FormReferenceImage[];
  className?: string;
}

export function ReferenceImageGallery({ references = [], className }: ReferenceImageGalleryProps) {
  const visibleReferences = references.filter(reference => reference.url?.trim());
  const [selectedReference, setSelectedReference] = useState<FormReferenceImage | null>(null);
  const [zoom, setZoom] = useState(MIN_ZOOM);

  if (visibleReferences.length === 0) return null;

  const closeLightbox = () => {
    setSelectedReference(null);
    setZoom(MIN_ZOOM);
  };

  const openLightbox = (reference: FormReferenceImage) => {
    setSelectedReference(reference);
    setZoom(MIN_ZOOM);
  };

  const zoomOut = () => setZoom(current => Math.max(MIN_ZOOM, current - ZOOM_STEP));
  const zoomIn = () => setZoom(current => Math.min(MAX_ZOOM, current + ZOOM_STEP));
  const toggleZoom = () => setZoom(current => current === MIN_ZOOM ? 2 : MIN_ZOOM);
  const zoomPercentage = Math.round(zoom * 100);

  return (
    <>
      <div
        className={cx(
          'mb-5 grid gap-3',
          visibleReferences.length > 1 && 'lg:grid-cols-2',
          className,
        )}
      >
        {visibleReferences.map(reference => (
          <button
            key={reference.id}
            type="button"
            onClick={() => openLightbox(reference)}
            aria-label={`Perbesar ${reference.label}`}
            className="group w-full cursor-zoom-in overflow-hidden rounded-2xl border border-zinc-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 motion-reduce:transition-none dark:border-zinc-700 dark:bg-zinc-950/50 dark:hover:border-indigo-500 dark:focus-visible:ring-offset-zinc-900"
          >
            <figure>
              <div className="relative flex min-h-56 items-center justify-center bg-zinc-50 p-3 sm:min-h-72 dark:bg-zinc-900">
                <img
                  src={reference.url}
                  alt={reference.alt || reference.label}
                  className="max-h-[28rem] w-full object-contain transition duration-300 group-hover:scale-[1.015] motion-reduce:transition-none"
                  loading="lazy"
                />
                <span className="absolute right-3 top-3 inline-flex min-h-9 items-center gap-1.5 rounded-full bg-zinc-950/80 px-3 py-2 text-[11px] font-bold text-white shadow-lg backdrop-blur-sm">
                  <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Perbesar
                </span>
              </div>
              <figcaption className="flex items-center justify-between gap-3 border-t border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
                <span className="text-[11px] font-black uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-300">
                  {reference.label}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-300">
                  <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
                  Klik untuk zoom
                </span>
              </figcaption>
            </figure>
          </button>
        ))}
      </div>

      <Dialog open={selectedReference !== null} onClose={closeLightbox} className="relative z-[100]">
        <div className="fixed inset-0 bg-zinc-950/95 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex min-h-0 items-stretch justify-center p-0 sm:p-4">
          <Dialog.Panel className="flex min-h-0 w-full max-w-[96rem] flex-col overflow-hidden bg-zinc-950 text-white shadow-2xl sm:rounded-3xl sm:border sm:border-white/10">
            <header className="flex min-h-16 items-center gap-3 border-b border-white/10 px-3 py-2 sm:px-5">
              <div className="min-w-0 flex-1">
                <Dialog.Title className="truncate text-sm font-bold sm:text-base">
                  {selectedReference?.label}
                </Dialog.Title>
                <p className="mt-0.5 text-[11px] text-zinc-400">Zoom {zoomPercentage}%</p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5" aria-label="Kontrol zoom">
                <button
                  type="button"
                  onClick={zoomOut}
                  disabled={zoom <= MIN_ZOOM}
                  aria-label="Perkecil gambar"
                  className="inline-flex size-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(MIN_ZOOM)}
                  disabled={zoom === MIN_ZOOM}
                  aria-label="Reset zoom"
                  className="hidden size-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35 sm:inline-flex"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={zoomIn}
                  disabled={zoom >= MAX_ZOOM}
                  aria-label="Perbesar gambar"
                  className="inline-flex size-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={closeLightbox}
                  aria-label="Tutup gambar"
                  className="ml-1 inline-flex size-10 items-center justify-center rounded-xl bg-white text-zinc-950 transition hover:bg-zinc-200"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </header>

            <div className="relative min-h-0 flex-1 overflow-auto overscroll-contain p-2 sm:p-4">
              <button
                type="button"
                onClick={toggleZoom}
                aria-label={zoom === MIN_ZOOM ? 'Perbesar gambar menjadi 200%' : 'Kembalikan gambar ke ukuran layar'}
                className={cx(
                  'm-auto flex shrink-0 items-center justify-center p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400',
                  zoom === MIN_ZOOM ? 'cursor-zoom-in' : 'cursor-zoom-out',
                )}
                style={{
                  width: `${zoom * 100}%`,
                  height: `${zoom * 100}%`,
                  minWidth: '100%',
                  minHeight: '100%',
                }}
              >
                {selectedReference && (
                  <img
                    src={selectedReference.url}
                    alt={selectedReference.alt || selectedReference.label}
                    className="h-full w-full object-contain shadow-2xl"
                  />
                )}
              </button>
            </div>

            <p className="border-t border-white/10 px-4 py-2.5 text-center text-[11px] text-zinc-400 sm:text-xs">
              Klik gambar untuk zoom 200%. Gunakan tombol +/- untuk mengatur hingga 300%.
            </p>
          </Dialog.Panel>
        </div>
      </Dialog>
    </>
  );
}

export default ReferenceImageGallery;
