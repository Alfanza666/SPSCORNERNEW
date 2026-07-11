import {
  ArrowLeft,
  Check,
  CloudOff,
  Eye,
  EyeOff,
  Loader2,
  Monitor,
  Redo2,
  Rocket,
  Save,
  Smartphone,
  Tablet,
  Undo2,
} from 'lucide-react';
import { useId } from 'react';
import type { BuilderDevice, BuilderSaveStatus } from './types';

export interface BuilderTopbarProps {
  title: string;
  onTitleChange: (title: string) => void;
  device: BuilderDevice;
  onDeviceChange: (device: BuilderDevice) => void;
  saveStatus?: BuilderSaveStatus;
  previewActive?: boolean;
  publishing?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  onBack: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onSave?: () => void;
  onTogglePreview: () => void;
  onPublish: () => void;
  className?: string;
}

const DEVICE_OPTIONS = [
  { value: 'desktop' as const, label: 'Desktop', icon: Monitor },
  { value: 'tablet' as const, label: 'Tablet', icon: Tablet },
  { value: 'mobile' as const, label: 'Mobile', icon: Smartphone },
];

const SAVE_LABEL: Record<BuilderSaveStatus, string> = {
  saved: 'Tersimpan',
  saving: 'Menyimpan…',
  unsaved: 'Belum disimpan',
  error: 'Gagal menyimpan',
};

export function BuilderTopbar({
  title,
  onTitleChange,
  device,
  onDeviceChange,
  saveStatus = 'saved',
  previewActive = false,
  publishing = false,
  canUndo = false,
  canRedo = false,
  onBack,
  onUndo,
  onRedo,
  onSave,
  onTogglePreview,
  onPublish,
  className = '',
}: BuilderTopbarProps) {
  const titleInputId = useId();

  return (
    <header
      className={`relative z-30 border-b border-slate-200/80 bg-white/95 px-3 py-2 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/95 sm:px-4 ${className}`}
    >
      <div className="flex min-h-12 flex-wrap items-center gap-2 lg:flex-nowrap">
        <button
          type="button"
          onClick={onBack}
          aria-label="Kembali ke daftar formulir"
          title="Kembali"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="min-w-0 flex-1 lg:max-w-sm">
          <label htmlFor={titleInputId} className="sr-only">Judul formulir</label>
          <input
            id={titleInputId}
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            className="w-full truncate rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-slate-900 outline-none transition hover:border-slate-200 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-500/15 dark:text-white dark:hover:border-zinc-700 dark:focus:bg-zinc-900"
            placeholder="Formulir tanpa judul"
          />
          <div
            className={`flex items-center gap-1.5 px-2 text-[10px] font-medium ${
              saveStatus === 'error'
                ? 'text-red-600'
                : saveStatus === 'unsaved'
                  ? 'text-amber-600'
                  : 'text-slate-400 dark:text-zinc-500'
            }`}
            role="status"
            aria-live="polite"
          >
            {saveStatus === 'saving' ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            ) : saveStatus === 'error' ? (
              <CloudOff className="h-3 w-3" aria-hidden="true" />
            ) : (
              <Check className="h-3 w-3" aria-hidden="true" />
            )}
            {SAVE_LABEL[saveStatus]}
          </div>
        </div>

        <div className="hidden items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-zinc-800 dark:bg-zinc-900 sm:flex" role="group" aria-label="Riwayat perubahan">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo || !onUndo}
            aria-label="Batalkan perubahan"
            title="Undo"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-35 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo || !onRedo}
            aria-label="Ulangi perubahan"
            title="Redo"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-35 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            <Redo2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <div
          className="order-3 flex basis-full items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-zinc-800 dark:bg-zinc-900 md:order-none md:basis-auto"
          role="group"
          aria-label="Ukuran pratinjau"
        >
          {DEVICE_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => onDeviceChange(value)}
              aria-pressed={device === value}
              title={label}
              className={`inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 md:flex-none ${
                device === value
                  ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200 dark:bg-zinc-800 dark:text-blue-300 dark:ring-zinc-700'
                  : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sm:hidden lg:inline">{label}</span>
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {onSave && (
            <button
              type="button"
              onClick={onSave}
              disabled={saveStatus === 'saving'}
              aria-label="Simpan perubahan formulir"
              className="hidden h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 sm:inline-flex"
            >
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
              Simpan
            </button>
          )}
          <button
            type="button"
            onClick={onTogglePreview}
            aria-pressed={previewActive}
            className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              previewActive
                ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'
            }`}
          >
            {previewActive ? <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
            <span className="hidden sm:inline">{previewActive ? 'Tutup preview' : 'Preview'}</span>
          </button>
          <button
            type="button"
            onClick={onPublish}
            disabled={publishing}
            aria-busy={publishing}
            aria-label={publishing ? 'Sedang menerbitkan formulir' : 'Terbitkan formulir'}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3.5 text-xs font-bold text-white shadow-[0_8px_24px_-10px_rgba(37,99,235,0.9)] transition hover:-translate-y-0.5 hover:from-blue-700 hover:to-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Rocket className="h-3.5 w-3.5" aria-hidden="true" />}
            Publish
          </button>
        </div>
      </div>
    </header>
  );
}

export default BuilderTopbar;
