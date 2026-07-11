import { useId, useState, type DragEvent, type ReactNode } from 'react';
import {
  Copy,
  GitBranch,
  GripVertical,
  Image as ImageIcon,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { FieldType, FormConfig, FormField } from '../../types/form';
import FormFieldRenderer from '../forms/FormFieldRenderer';
import DevicePreview from './DevicePreview';
import {
  BUILDER_HEADER_ID,
  SPS_FIELD_DRAG_MIME,
  SPS_REORDER_DRAG_MIME,
  type BuilderDevice,
  type FormAppearanceUpdates,
} from './types';

export interface BuilderCanvasProps {
  form: FormConfig;
  device?: BuilderDevice;
  selectedFieldId?: string | null;
  readOnly?: boolean;
  onSelectField?: (fieldId: string | null) => void;
  onUpdateForm?: (updates: FormAppearanceUpdates) => void;
  onInsertField?: (targetIndex: number) => void;
  onDropField?: (type: FieldType, targetIndex: number) => void;
  onReorderField?: (fieldId: string, targetIndex: number) => void;
  onDuplicateField?: (fieldId: string) => void;
  onDeleteField?: (fieldId: string) => void;
  renderField?: (field: FormField) => ReactNode;
  className?: string;
}

export function BuilderCanvas({
  form,
  device = 'desktop',
  selectedFieldId = null,
  readOnly = false,
  onSelectField,
  onUpdateForm,
  onInsertField,
  onDropField,
  onReorderField,
  onDuplicateField,
  onDeleteField,
  renderField,
  className = '',
}: BuilderCanvasProps) {
  const [draggedFieldId, setDraggedFieldId] = useState<string | null>(null);
  const [activeDropIndex, setActiveDropIndex] = useState<number | null>(null);
  const titleInputId = useId();
  const descriptionInputId = useId();
  const themeColor = form.theme_color || '#0054A6';

  const acceptsBuilderDrag = (event: DragEvent) =>
    event.dataTransfer.types.includes(SPS_FIELD_DRAG_MIME) ||
    event.dataTransfer.types.includes(SPS_REORDER_DRAG_MIME);

  const handleDrop = (event: DragEvent, targetIndex: number) => {
    if (!acceptsBuilderDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    const paletteType = event.dataTransfer.getData(SPS_FIELD_DRAG_MIME) as FieldType;
    const sourceFieldId = event.dataTransfer.getData(SPS_REORDER_DRAG_MIME) || draggedFieldId;

    if (paletteType) onDropField?.(paletteType, targetIndex);
    else if (sourceFieldId) onReorderField?.(sourceFieldId, targetIndex);

    setActiveDropIndex(null);
    setDraggedFieldId(null);
  };

  return (
    <main
      aria-label="Canvas formulir"
      className={`relative min-h-full overflow-y-auto bg-slate-100/90 px-3 py-6 dark:bg-zinc-950 sm:px-6 lg:px-8 ${className}`}
      style={{
        backgroundImage:
          'radial-gradient(circle at 1px 1px, rgba(100,116,139,0.15) 1px, transparent 0)',
        backgroundSize: '22px 22px',
      }}
      onClick={() => onSelectField?.(null)}
    >
      <DevicePreview device={device} title={form.title || 'Formulir tanpa judul'}>
        <div
          className="relative min-h-[560px] bg-slate-50 dark:bg-zinc-950"
          style={{
            backgroundImage: form.bg_image_url ? `url(${form.bg_image_url})` : undefined,
            backgroundPosition: 'center',
            backgroundSize: 'cover',
            fontFamily: form.font_family || 'Inter',
          }}
        >
          {form.bg_image_url && <div className="absolute inset-0 bg-slate-950/25 backdrop-blur-[1px]" aria-hidden="true" />}

          <div className={`relative mx-auto px-3 py-6 sm:px-6 sm:py-8 ${device === 'mobile' ? 'max-w-full' : 'max-w-[760px]'}`}>
            <section
              tabIndex={!readOnly && onSelectField ? 0 : undefined}
              aria-label="Header formulir"
              aria-current={selectedFieldId === BUILDER_HEADER_ID ? 'true' : undefined}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return;
                event.preventDefault();
                onSelectField?.(BUILDER_HEADER_ID);
              }}
              onClick={(event) => {
                event.stopPropagation();
                onSelectField?.(BUILDER_HEADER_ID);
              }}
              className={`group relative overflow-hidden rounded-[24px] border bg-white shadow-[0_18px_60px_-36px_rgba(15,23,42,0.5)] transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/20 dark:bg-zinc-900 ${
                selectedFieldId === BUILDER_HEADER_ID
                  ? 'border-blue-400 ring-4 ring-blue-500/10'
                  : 'border-slate-200/90 hover:border-slate-300 dark:border-zinc-800 dark:hover:border-zinc-700'
              }`}
            >
              {form.banner_url ? (
                <div className="relative h-40 overflow-hidden sm:h-52">
                  <img src={form.banner_url} alt="Banner formulir" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/30 to-transparent" aria-hidden="true" />
                </div>
              ) : (
                <div className="h-2" style={{ backgroundColor: themeColor }} aria-hidden="true" />
              )}

              <div className="px-5 py-6 sm:px-8 sm:py-8">
                {onUpdateForm && !readOnly ? (
                  <>
                    <label htmlFor={titleInputId} className="sr-only">Judul formulir</label>
                    <input
                      id={titleInputId}
                      value={form.title}
                      onChange={(event) => onUpdateForm({ title: event.target.value })}
                      onClick={(event) => event.stopPropagation()}
                      className="w-full rounded-lg border border-transparent bg-transparent px-1 py-1 text-2xl font-bold tracking-tight text-slate-950 outline-none transition hover:border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 dark:text-white dark:hover:border-zinc-700 sm:text-3xl"
                      placeholder="Judul formulir"
                    />
                    <label htmlFor={descriptionInputId} className="sr-only">Deskripsi formulir</label>
                    <textarea
                      id={descriptionInputId}
                      value={form.description || ''}
                      onChange={(event) => onUpdateForm({ description: event.target.value })}
                      onClick={(event) => event.stopPropagation()}
                      rows={2}
                      className="mt-2 w-full resize-none rounded-lg border border-transparent bg-transparent px-1 py-1 text-sm leading-6 text-slate-500 outline-none transition hover:border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 dark:text-zinc-400 dark:hover:border-zinc-700"
                      placeholder="Tambahkan deskripsi atau petunjuk singkat…"
                    />
                  </>
                ) : (
                  <>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
                      {form.title || 'Formulir tanpa judul'}
                    </h1>
                    <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-zinc-400">
                      {form.description || 'Tambahkan deskripsi agar pengisi memahami tujuan formulir.'}
                    </p>
                  </>
                )}
              </div>
            </section>

            <div className="mt-3">
              <InsertionControl
                index={0}
                active={activeDropIndex === 0}
                disabled={readOnly}
                onInsert={onInsertField}
                onDragOver={(event) => {
                  if (!acceptsBuilderDrag(event)) return;
                  event.preventDefault();
                  setActiveDropIndex(0);
                }}
                onDragLeave={(event) => {
                  if (event.currentTarget.contains(event.relatedTarget as Node)) return;
                  setActiveDropIndex((current) => current === 0 ? null : current);
                }}
                onDrop={handleDrop}
              />

              {form.fields.length === 0 ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onInsertField?.(0);
                  }}
                  disabled={readOnly || !onInsertField}
                  className="flex min-h-64 w-full flex-col items-center justify-center rounded-[24px] border-2 border-dashed border-slate-300 bg-white/90 px-6 text-center transition hover:border-blue-400 hover:bg-blue-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-default dark:border-zinc-700 dark:bg-zinc-900/90 dark:hover:border-blue-700 dark:hover:bg-blue-950/10"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
                    <Sparkles className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="mt-4 text-sm font-bold text-slate-800 dark:text-white">Mulai susun pengalaman Anda</span>
                  <span className="mt-1 max-w-sm text-xs leading-5 text-slate-500 dark:text-zinc-400">
                    Pilih elemen dari panel kiri atau seret ke canvas ini.
                  </span>
                </button>
              ) : (
                form.fields.map((field, index) => {
                  const isSelected = selectedFieldId === field.id;
                  return (
                    <div key={field.id}>
                      <article
                        draggable={!readOnly && Boolean(onReorderField)}
                        tabIndex={!readOnly && onSelectField ? 0 : undefined}
                        aria-label={`Pertanyaan ${index + 1}: ${field.label || 'Tanpa judul'}`}
                        aria-current={isSelected ? 'step' : undefined}
                        onDragStart={(event) => {
                          setDraggedFieldId(field.id);
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData(SPS_REORDER_DRAG_MIME, field.id);
                        }}
                        onDragEnd={() => {
                          setDraggedFieldId(null);
                          setActiveDropIndex(null);
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectField?.(field.id);
                        }}
                        onKeyDown={(event) => {
                          if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return;
                          event.preventDefault();
                          onSelectField?.(field.id);
                        }}
                        className={`group relative rounded-[22px] border bg-white px-5 py-5 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/20 dark:bg-zinc-900 sm:px-7 sm:py-6 ${
                          isSelected
                            ? 'z-10 border-blue-400 shadow-[0_18px_45px_-28px_rgba(37,99,235,0.8)] ring-4 ring-blue-500/10'
                            : 'border-slate-200/90 shadow-[0_10px_35px_-32px_rgba(15,23,42,0.6)] hover:border-slate-300 hover:shadow-md dark:border-zinc-800 dark:hover:border-zinc-700'
                        } ${draggedFieldId === field.id ? 'opacity-45' : ''}`}
                      >
                        <div className="mb-4 flex items-start gap-3">
                          <GripVertical
                            className="mt-0.5 h-5 w-5 shrink-0 cursor-grab text-slate-300 opacity-0 transition group-hover:opacity-100 dark:text-zinc-600"
                            aria-hidden="true"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-base font-semibold leading-6 text-slate-900 dark:text-white sm:text-lg">
                                {field.label || 'Pertanyaan tanpa label'}
                                {field.required && <span className="ml-1 text-red-500" aria-label="wajib diisi">*</span>}
                              </h2>
                              {field.condition && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                                  <GitBranch className="h-3 w-3" aria-hidden="true" /> Bersyarat
                                </span>
                              )}
                            </div>
                            {field.description && (
                              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">{field.description}</p>
                            )}
                          </div>
                        </div>

                        <div className="pointer-events-none pl-0 sm:pl-8">
                          {renderField ? (
                            renderField(field)
                          ) : (
                            <FormFieldRenderer
                              field={field}
                              themeColor={themeColor}
                              inputStyle={form.input_style || 'rounded'}
                              disabled
                            />
                          )}
                        </div>

                        {isSelected && !readOnly && (
                          <div className="absolute -top-4 right-3 flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onDuplicateField?.(field.id);
                              }}
                              disabled={!onDuplicateField}
                              aria-label={`Duplikasi ${field.label}`}
                              title="Duplikasi"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30 dark:hover:bg-zinc-800 dark:hover:text-white"
                            >
                              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onDeleteField?.(field.id);
                              }}
                              disabled={!onDeleteField}
                              aria-label={`Hapus ${field.label}`}
                              title="Hapus"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-30 dark:hover:bg-red-950/30"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        )}
                      </article>

                      <InsertionControl
                        index={index + 1}
                        active={activeDropIndex === index + 1}
                        disabled={readOnly}
                        onInsert={onInsertField}
                        onDragOver={(event) => {
                          if (!acceptsBuilderDrag(event)) return;
                          event.preventDefault();
                          setActiveDropIndex(index + 1);
                        }}
                        onDragLeave={(event) => {
                          if (event.currentTarget.contains(event.relatedTarget as Node)) return;
                          setActiveDropIndex((current) => current === index + 1 ? null : current);
                        }}
                        onDrop={handleDrop}
                      />
                    </div>
                  );
                })
              )}

              {form.fields.length > 0 && !readOnly && onInsertField && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onInsertField(form.fields.length);
                  }}
                  className="mt-1 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white/70 text-xs font-semibold text-slate-500 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900/70 dark:hover:border-blue-700 dark:hover:bg-blue-950/20 dark:hover:text-blue-300"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" /> Tambah pertanyaan
                </button>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between px-2 text-[10px] font-medium text-slate-400 dark:text-zinc-500">
              <span>{form.fields.length} pertanyaan</span>
              <span className="inline-flex items-center gap-1">
                <ImageIcon className="h-3 w-3" aria-hidden="true" /> SPS Form Experience
              </span>
            </div>
          </div>
        </div>
      </DevicePreview>
    </main>
  );
}

interface InsertionControlProps {
  index: number;
  active: boolean;
  disabled: boolean;
  onInsert?: (index: number) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave?: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>, index: number) => void;
}

function InsertionControl({ index, active, disabled, onInsert, onDragOver, onDragLeave, onDrop }: InsertionControlProps) {
  return (
    <div
      className={`group relative flex h-8 items-center justify-center transition ${active ? 'h-14' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={(event) => onDrop(event, index)}
    >
      <div
        aria-hidden="true"
        className={`absolute left-0 right-0 h-px transition ${
          active ? 'h-0.5 bg-blue-500' : 'bg-transparent group-hover:bg-blue-300'
        }`}
      />
      {!disabled && onInsert && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onInsert(index);
          }}
          aria-label={`Tambahkan pertanyaan di posisi ${index + 1}`}
          title="Sisipkan pertanyaan"
          className={`relative z-10 inline-flex items-center justify-center rounded-full border border-blue-200 bg-white text-blue-600 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-blue-900 dark:bg-zinc-900 dark:text-blue-300 ${
            active ? 'h-8 w-8 scale-100 opacity-100' : 'h-7 w-7 scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100 focus:scale-100 focus:opacity-100'
          }`}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
      {active && (
        <span className="absolute bottom-0 rounded-full bg-blue-600 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white">
          Lepaskan di sini
        </span>
      )}
    </div>
  );
}

export default BuilderCanvas;
