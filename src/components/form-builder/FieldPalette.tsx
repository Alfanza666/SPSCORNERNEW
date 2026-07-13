import { useId, useState, type DragEvent } from 'react';
import {
  AlignLeft,
  CalendarDays,
  CheckSquare2,
  ChevronDown,
  CircleDot,
  CreditCard,
  FileUp,
  Gauge,
  Hash,
  Image,
  ImagePlus,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Type,
  UsersRound,
  X,
} from 'lucide-react';
import type { FieldType } from '../../types/form';
import { SPS_FIELD_DRAG_MIME, type FieldPaletteGroup } from './types';

export const DEFAULT_FIELD_PALETTE: FieldPaletteGroup[] = [
  {
    id: 'basic',
    label: 'Pertanyaan dasar',
    items: [
      { type: 'text', label: 'Teks singkat', description: 'Nama, NIK, atau jawaban ringkas', icon: Type, accent: '#2563EB', surface: '#EFF6FF' },
      { type: 'textarea', label: 'Paragraf', description: 'Jawaban panjang dan catatan', icon: AlignLeft, accent: '#7C3AED', surface: '#F5F3FF' },
      { type: 'number', label: 'Angka', description: 'Jumlah atau nilai numerik', icon: Hash, accent: '#0891B2', surface: '#ECFEFF' },
      { type: 'date', label: 'Tanggal', description: 'Pemilih tanggal yang terstruktur', icon: CalendarDays, accent: '#4F46E5', surface: '#EEF2FF' },
    ],
  },
  {
    id: 'choice',
    label: 'Pilihan',
    items: [
      { type: 'radio', label: 'Pilihan tunggal', description: 'Pilih tepat satu jawaban', icon: CircleDot, accent: '#EA580C', surface: '#FFF7ED' },
      { type: 'checkbox', label: 'Pilihan jamak', description: 'Pilih beberapa jawaban', icon: CheckSquare2, accent: '#DB2777', surface: '#FDF2F8' },
      { type: 'select', label: 'Dropdown', description: 'Daftar pilihan yang ringkas', icon: ChevronDown, accent: '#059669', surface: '#ECFDF5' },
      { type: 'image_choice', label: 'Pilihan gambar', description: 'Jawaban visual berbentuk kartu', icon: Image, accent: '#C026D3', surface: '#FDF4FF' },
    ],
  },
  {
    id: 'advanced',
    label: 'Interaktif',
    items: [
      { type: 'rating', label: 'Rating', description: 'Nilai dengan ikon bintang', icon: Star, accent: '#E11D48', surface: '#FFF1F2' },
      { type: 'scale', label: 'Skala', description: 'Penilaian dalam rentang angka', icon: Gauge, accent: '#0D9488', surface: '#F0FDFA' },
      { type: 'file_upload', label: 'Upload file', description: 'Dokumen atau lampiran', icon: FileUp, accent: '#475569', surface: '#F8FAFC' },
      { type: 'image', label: 'Upload gambar', description: 'Foto atau bukti visual', icon: ImagePlus, accent: '#0284C7', surface: '#F0F9FF' },
      { type: 'repeater', label: 'Daftar berulang', description: 'Anggota keluarga atau peserta tambahan', icon: UsersRound, accent: '#7C3AED', surface: '#F5F3FF' },
    ],
  },
  {
    id: 'commerce',
    label: 'Pesanan & pembayaran',
    items: [
      { type: 'addon_group', label: 'Add-on checkout', description: 'Tenda, matras, fasilitas, jumlah, dan harga', icon: ShoppingBag, accent: '#C2410C', surface: '#FFF7ED' },
      { type: 'payment_section', label: 'Pembayaran', description: 'Ringkasan total dan bukti bayar', icon: CreditCard, accent: '#047857', surface: '#ECFDF5' },
    ],
  },
];

export interface FieldPaletteProps {
  onAddField: (type: FieldType) => void;
  groups?: FieldPaletteGroup[];
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onClose?: () => void;
  title?: string;
  className?: string;
  compact?: boolean;
}

export function FieldPalette({
  onAddField,
  groups = DEFAULT_FIELD_PALETTE,
  searchValue,
  onSearchChange,
  onClose,
  title = 'Elemen formulir',
  className = '',
  compact = false,
}: FieldPaletteProps) {
  const searchId = useId();
  const [internalSearch, setInternalSearch] = useState('');
  const query = searchValue === undefined ? internalSearch : searchValue;
  const normalizedQuery = query.trim().toLocaleLowerCase('id-ID');
  const filteredGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        `${item.label} ${item.description}`.toLocaleLowerCase('id-ID').includes(normalizedQuery),
      ),
    }))
    .filter((group) => group.items.length > 0);

  const handleDragStart = (event: DragEvent<HTMLButtonElement>, type: FieldType) => {
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData(SPS_FIELD_DRAG_MIME, type);
  };

  const handleSearchChange = (value: string) => {
    if (searchValue === undefined) setInternalSearch(value);
    onSearchChange?.(value);
  };

  return (
    <aside
      aria-label={title}
      className={`flex h-full min-h-0 flex-col border-r border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 ${className}`}
    >
      <div className="border-b border-slate-100 px-4 pb-3 pt-4 dark:border-zinc-800">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h2>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-zinc-400">
              Klik atau seret ke posisi yang diinginkan.
            </p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup daftar elemen"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-zinc-800 dark:hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="relative mt-4">
          <label htmlFor={searchId} className="sr-only">Cari elemen formulir</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Cari elemen…"
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-xs text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-500/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:bg-zinc-900"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
        {filteredGroups.length > 0 ? (
          <div className="space-y-5">
            {filteredGroups.map((group) => (
              <section key={group.id} aria-labelledby={`palette-group-${group.id}`}>
                <h3
                  id={`palette-group-${group.id}`}
                  className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-zinc-500"
                >
                  {group.label}
                </h3>
                <div className={compact ? 'grid grid-cols-2 gap-2' : 'space-y-1'}>
                  {group.items.map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      draggable
                      onDragStart={(event) => handleDragStart(event, item.type)}
                      onClick={() => onAddField(item.type)}
                      aria-label={`Tambahkan ${item.label}`}
                      className={`group relative flex w-full cursor-grab items-center gap-3 rounded-xl border border-transparent text-left transition active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        compact
                          ? 'min-h-24 flex-col items-start justify-between border-slate-200 bg-white p-3 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900'
                          : 'px-2.5 py-2.5 hover:border-slate-200 hover:bg-slate-50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900'
                      }`}
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-black/[0.03] transition group-hover:scale-105 dark:ring-white/[0.06]"
                        style={{ backgroundColor: item.surface, color: item.accent }}
                      >
                        <item.icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold text-slate-700 transition group-hover:text-slate-950 dark:text-zinc-200 dark:group-hover:text-white">
                          {item.label}
                        </span>
                        {!compact && (
                          <span className="mt-0.5 block truncate text-[10px] text-slate-400 dark:text-zinc-500">
                            {item.description}
                          </span>
                        )}
                      </span>
                      {!compact && (
                        <span className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-sm text-slate-400 opacity-0 transition group-hover:opacity-100 dark:border-zinc-700 dark:bg-zinc-800">
                          +
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 px-5 text-center dark:border-zinc-800">
            <Search className="mb-3 h-7 w-7 text-slate-300 dark:text-zinc-600" aria-hidden="true" />
            <p className="text-sm font-semibold text-slate-600 dark:text-zinc-300">Elemen tidak ditemukan</p>
            <p className="mt-1 text-xs text-slate-400">Coba kata kunci yang lebih singkat.</p>
          </div>
        )}
      </div>
    </aside>
  );
}

export default FieldPalette;
