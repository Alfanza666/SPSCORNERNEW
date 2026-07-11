import { useId, type KeyboardEvent, type ReactNode } from 'react';
import {
  Bot,
  Check,
  GitBranch,
  Info,
  Palette,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import type { FormConfig, FormField } from '../../types/form';
import type { FieldUpdateHandler, FormAppearanceUpdates, InspectorTab } from './types';

export interface InspectorPanelProps {
  form: FormConfig;
  selectedField?: FormField | null;
  activeTab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  onUpdateField?: FieldUpdateHandler;
  onUpdateForm?: (updates: FormAppearanceUpdates) => void;
  panels?: Partial<Record<InspectorTab, ReactNode>>;
  onClose?: () => void;
  className?: string;
}

const TABS = [
  { value: 'field' as const, label: 'Field', icon: SlidersHorizontal },
  { value: 'logic' as const, label: 'Logic', icon: GitBranch },
  { value: 'design' as const, label: 'Design', icon: Palette },
  { value: 'settings' as const, label: 'Setup', icon: Settings2 },
  { value: 'ai' as const, label: 'AI', icon: Sparkles },
];

const THEME_PRESETS = ['#0054A6', '#2563EB', '#4F46E5', '#7C3AED', '#DB2777', '#DC2626', '#D97706', '#059669', '#0F172A'];

export function InspectorPanel({
  form,
  selectedField = null,
  activeTab,
  onTabChange,
  onUpdateField,
  onUpdateForm,
  panels,
  onClose,
  className = '',
}: InspectorPanelProps) {
  const panelId = useId();
  const customPanel = panels?.[activeTab];

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % TABS.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = TABS.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    onTabChange(TABS[nextIndex].value);
    const tabButtons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabButtons?.[nextIndex]?.focus();
  };

  return (
    <aside
      aria-label="Inspector formulir"
      className={`flex h-full min-h-0 flex-col border-l border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 ${className}`}
    >
      <div className="flex min-h-14 items-center gap-3 border-b border-slate-100 px-4 dark:border-zinc-800">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-zinc-900">
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xs font-bold text-slate-900 dark:text-white">Inspector</h2>
          <p className="truncate text-[10px] text-slate-400 dark:text-zinc-500">
            {selectedField ? selectedField.label : 'Pengaturan formulir'}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup inspector"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <div
        role="tablist"
        aria-label="Bagian inspector"
        className="flex shrink-0 overflow-x-auto border-b border-slate-100 px-2 dark:border-zinc-800"
      >
        {TABS.map(({ value, label, icon: Icon }, index) => (
          <button
            key={value}
            id={`${panelId}-${value}-tab`}
            type="button"
            role="tab"
            aria-selected={activeTab === value}
            aria-controls={`${panelId}-${value}-panel`}
            tabIndex={activeTab === value ? 0 : -1}
            onClick={() => onTabChange(value)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
            className={`relative inline-flex min-w-14 flex-1 items-center justify-center gap-1.5 px-2 py-3 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${
              activeTab === value
                ? 'text-blue-700 dark:text-blue-300'
                : 'text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-200'
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{label}</span>
            {activeTab === value && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-blue-600" aria-hidden="true" />}
          </button>
        ))}
      </div>

      <div
        id={`${panelId}-${activeTab}-panel`}
        role="tabpanel"
        aria-labelledby={`${panelId}-${activeTab}-tab`}
        tabIndex={0}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain focus:outline-none"
      >
        {customPanel ?? (
          <DefaultPanel
            activeTab={activeTab}
            form={form}
            selectedField={selectedField}
            onUpdateField={onUpdateField}
            onUpdateForm={onUpdateForm}
          />
        )}
      </div>
    </aside>
  );
}

interface DefaultPanelProps {
  activeTab: InspectorTab;
  form: FormConfig;
  selectedField: FormField | null;
  onUpdateField?: FieldUpdateHandler;
  onUpdateForm?: (updates: FormAppearanceUpdates) => void;
}

function DefaultPanel({ activeTab, form, selectedField, onUpdateField, onUpdateForm }: DefaultPanelProps) {
  if (activeTab === 'field') {
    if (!selectedField) {
      return (
        <EmptyInspector
          icon={<SlidersHorizontal className="h-5 w-5" aria-hidden="true" />}
          title="Pilih pertanyaan"
          description="Klik salah satu field pada canvas untuk mengubah isi, aturan wajib, dan petunjuknya."
        />
      );
    }

    const disabled = !onUpdateField;
    const update = (updates: Partial<FormField>) => onUpdateField?.(selectedField.id, updates);
    const supportsPlaceholder = ['text', 'textarea', 'number'].includes(selectedField.type);

    return (
      <div className="space-y-6 p-4">
        <PanelHeading
          eyebrow={selectedField.type.replace(/_/g, ' ')}
          title="Properti pertanyaan"
          description="Perubahan ditampilkan langsung pada canvas."
        />

        <div className="space-y-4">
          <InspectorField label="Judul pertanyaan" htmlFor="inspector-field-label">
            <textarea
              id="inspector-field-label"
              rows={2}
              value={selectedField.label}
              onChange={(event) => update({ label: event.target.value })}
              disabled={disabled}
              className={CONTROL_CLASS}
              placeholder="Tulis pertanyaan…"
            />
          </InspectorField>

          <InspectorField label="Deskripsi / bantuan" htmlFor="inspector-field-description" optional>
            <textarea
              id="inspector-field-description"
              rows={3}
              value={selectedField.description || ''}
              onChange={(event) => update({ description: event.target.value })}
              disabled={disabled}
              className={CONTROL_CLASS}
              placeholder="Berikan konteks singkat kepada pengisi…"
            />
          </InspectorField>

          {supportsPlaceholder && (
            <InspectorField label="Placeholder" htmlFor="inspector-field-placeholder" optional>
              <input
                id="inspector-field-placeholder"
                type="text"
                value={selectedField.placeholder || ''}
                onChange={(event) => update({ placeholder: event.target.value })}
                disabled={disabled}
                className={CONTROL_CLASS}
                placeholder="Contoh jawaban…"
              />
            </InspectorField>
          )}

          {selectedField.type !== 'payment_section' && (
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="pr-3">
                <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200">Wajib diisi</p>
                <p className="mt-0.5 text-[10px] leading-4 text-slate-400 dark:text-zinc-500">Pengisi tidak dapat melanjutkan tanpa jawaban.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={selectedField.required}
                onClick={() => update({ required: !selectedField.required })}
                disabled={disabled}
                className={`relative h-6 w-11 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 ${
                  selectedField.required ? 'bg-blue-600' : 'bg-slate-300 dark:bg-zinc-700'
                }`}
              >
                <span
                  className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                    selectedField.required ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3.5 text-[11px] leading-5 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/25 dark:text-blue-300">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Pengaturan opsi, harga, upload, dan pembayaran dapat ditempatkan sebagai editor khusus di slot panel Field ini.
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 'design') {
    const disabled = !onUpdateForm;
    const update = (updates: FormAppearanceUpdates) => onUpdateForm?.(updates);

    return (
      <div className="space-y-6 p-4">
        <PanelHeading eyebrow="Brand experience" title="Desain formulir" description="Bangun tampilan konsisten tanpa memengaruhi halaman lain." />

        <InspectorField label="Warna utama" htmlFor="inspector-theme-color">
          <div className="grid grid-cols-9 gap-2">
            {THEME_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => update({ theme_color: color })}
                disabled={disabled}
                aria-label={`Gunakan warna ${color}`}
                aria-pressed={(form.theme_color || '#0054A6').toUpperCase() === color.toUpperCase()}
                className="relative h-7 rounded-lg border border-black/5 transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
                style={{ backgroundColor: color }}
              >
                {(form.theme_color || '#0054A6').toUpperCase() === color.toUpperCase() && (
                  <Check className="absolute inset-0 m-auto h-3.5 w-3.5 text-white drop-shadow" aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              id="inspector-theme-color"
              type="color"
              value={form.theme_color || '#0054A6'}
              onChange={(event) => update({ theme_color: event.target.value })}
              disabled={disabled}
              className="h-10 w-11 cursor-pointer rounded-xl border border-slate-200 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <input
              aria-label="Kode warna tema"
              type="text"
              value={form.theme_color || '#0054A6'}
              onChange={(event) => update({ theme_color: event.target.value })}
              disabled={disabled}
              className={`${CONTROL_CLASS} font-mono uppercase`}
            />
          </div>
        </InspectorField>

        <InspectorField label="Pengalaman pengisian">
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'classic' as const, title: 'Classic', description: 'Satu halaman' },
              { value: 'card' as const, title: 'Card form', description: 'Satu per langkah' },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => update({ layout_type: option.value })}
                disabled={disabled}
                aria-pressed={(form.layout_type || 'classic') === option.value}
                className={`rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  (form.layout_type || 'classic') === option.value
                    ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-500/10 dark:bg-blue-950/25'
                    : 'border-slate-200 hover:border-slate-300 dark:border-zinc-700 dark:hover:border-zinc-600'
                }`}
              >
                <span className="block text-xs font-bold text-slate-800 dark:text-zinc-200">{option.title}</span>
                <span className="mt-1 block text-[10px] text-slate-400 dark:text-zinc-500">{option.description}</span>
              </button>
            ))}
          </div>
        </InspectorField>

        <InspectorField label="Typography" htmlFor="inspector-font-family">
          <select
            id="inspector-font-family"
            value={form.font_family || 'Inter'}
            onChange={(event) => update({ font_family: event.target.value })}
            disabled={disabled}
            className={CONTROL_CLASS}
          >
            <option value="Inter">Inter — Clean</option>
            <option value="Outfit">Outfit — Modern</option>
            <option value="Space Grotesk">Space Grotesk — Editorial</option>
            <option value="Playfair Display">Playfair Display — Elegant</option>
          </select>
        </InspectorField>

        <InspectorField label="Gaya input">
          <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-zinc-800 dark:bg-zinc-900">
            {(['rounded', 'sharp', 'underline'] as const).map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => update({ input_style: style })}
                disabled={disabled}
                aria-pressed={(form.input_style || 'rounded') === style}
                className={`h-8 flex-1 rounded-lg text-[10px] font-semibold capitalize transition ${
                  (form.input_style || 'rounded') === style
                    ? 'bg-white text-blue-700 shadow-sm dark:bg-zinc-800 dark:text-blue-300'
                    : 'text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-200'
                }`}
              >
                {style}
              </button>
            ))}
          </div>
        </InspectorField>

        <div className="flex items-center justify-between rounded-2xl border border-slate-200 p-3.5 dark:border-zinc-800">
          <div className="pr-3">
            <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200">Glass surface</p>
            <p className="mt-0.5 text-[10px] text-slate-400">Cocok untuk background foto acara.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(form.card_glassmorphism)}
            onClick={() => update({ card_glassmorphism: !form.card_glassmorphism })}
            disabled={disabled}
            className={`relative h-6 w-11 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 ${form.card_glassmorphism ? 'bg-blue-600' : 'bg-slate-300 dark:bg-zinc-700'}`}
          >
            <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${form.card_glassmorphism ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>
    );
  }

  if (activeTab === 'logic') {
    return (
      <EmptyInspector
        icon={<GitBranch className="h-5 w-5" aria-hidden="true" />}
        title="Atur alur jawaban"
        description="Pasang LogicFlowPanel pada slot ini untuk mengelola cabang Ya/Tidak dan melihat jalur sampai selesai."
      />
    );
  }

  if (activeTab === 'ai') {
    return (
      <EmptyInspector
        icon={<Bot className="h-5 w-5" aria-hidden="true" />}
        title="AI Form Copilot"
        description="Panel percakapan AI dapat ditempatkan di sini dan tetap terpisah dari properti field."
      />
    );
  }

  const requiredCount = form.fields.filter((field) => field.required).length;
  const conditionalCount = form.fields.filter((field) => field.condition).length;
  return (
    <div className="space-y-6 p-4">
      <PanelHeading eyebrow="Form health" title="Setup & publikasi" description="Ringkasan struktur sebelum formulir dipublikasikan." />
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Field', value: form.fields.length },
          { label: 'Wajib', value: requiredCount },
          { label: 'Cabang', value: conditionalCount },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-lg font-bold text-slate-900 dark:text-white">{item.value}</p>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">{item.label}</p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <Check className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-bold text-emerald-900 dark:text-emerald-300">Struktur siap diperiksa</p>
            <p className="mt-1 text-[10px] leading-5 text-emerald-700 dark:text-emerald-400">Tambahkan panel target peserta, program, automasi kupon, dan status publikasi melalui slot Settings.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const CONTROL_CLASS =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:bg-zinc-900';

function InspectorField({
  label,
  htmlFor,
  optional = false,
  children,
}: {
  label: string;
  htmlFor?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  const LabelTag = htmlFor ? 'label' : 'div';
  return (
    <div>
      <LabelTag {...(htmlFor ? { htmlFor } : {})} className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">
        <span>{label}</span>
        {optional && <span className="font-medium normal-case tracking-normal text-slate-300 dark:text-zinc-600">Opsional</span>}
      </LabelTag>
      {children}
    </div>
  );
}

function PanelHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">{eyebrow}</p>
      <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-white">{title}</h3>
      <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-zinc-400">{description}</p>
    </div>
  );
}

function EmptyInspector({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center px-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        {icon}
      </div>
      <h3 className="mt-4 text-sm font-bold text-slate-800 dark:text-white">{title}</h3>
      <p className="mt-1 max-w-xs text-[11px] leading-5 text-slate-400 dark:text-zinc-500">{description}</p>
    </div>
  );
}

export default InspectorPanel;
