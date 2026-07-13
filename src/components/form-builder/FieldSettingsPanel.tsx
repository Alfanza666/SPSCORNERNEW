import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  CreditCard,
  GitBranch,
  Image as ImageIcon,
  Plus,
  Settings2,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import imageCompression from 'browser-image-compression';
import { supabase } from '../../lib/supabase';
import type {
  BankAccountConfig,
  FieldType,
  FormField,
  FormReferenceImage,
  FormOption,
  ManualPaymentMethod,
} from '../../types/form';

export interface FieldSettingsPanelProps {
  field: FormField;
  index: number;
  allFields: FormField[];
  outcomes?: Array<{ id: string; title: string }>;
  onUpdate: (updates: Partial<FormField>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (direction: 'up' | 'down') => void;
}

const FIELD_TYPES: Array<{ value: FieldType; label: string }> = [
  { value: 'text', label: 'Teks singkat' },
  { value: 'textarea', label: 'Paragraf' },
  { value: 'number', label: 'Angka / kuantitas' },
  { value: 'radio', label: 'Pilihan tunggal' },
  { value: 'checkbox', label: 'Pilihan jamak' },
  { value: 'select', label: 'Dropdown' },
  { value: 'image_choice', label: 'Pilihan gambar' },
  { value: 'repeater', label: 'Daftar berulang' },
  { value: 'addon_group', label: 'Daftar pesanan' },
  { value: 'payment_section', label: 'Pembayaran manual' },
  { value: 'date', label: 'Tanggal' },
  { value: 'rating', label: 'Rating' },
  { value: 'scale', label: 'Skala' },
  { value: 'file_upload', label: 'Upload file' },
  { value: 'image', label: 'Upload gambar' },
];

const CONTROL =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white';

const SMALL_CONTROL =
  'min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200';

const REFERENCE_IMAGE_SLOTS: Array<{ id: string; label: string; helper: string }> = [
  { id: 'shirt_design', label: 'Desain baju', helper: 'Contoh visual baju yang akan dipilih peserta.' },
  { id: 'size_chart', label: 'Size chart', helper: 'Panduan ukuran agar peserta tidak salah memilih.' },
];

function typeDefaults(type: FieldType): Partial<FormField> {
  if (['radio', 'checkbox', 'select', 'image_choice'].includes(type)) {
    return { options: [{ value: 'option_1', label: 'Opsi 1' }] };
  }
  if (type === 'repeater') {
    return {
      item_label: 'Anggota',
      min_items: 0,
      max_items: 5,
      item_unit_price: 0,
      subfields: [
        { id: 'name', type: 'text', label: 'Nama lengkap', required: true },
        { id: 'relation', type: 'select', label: 'Hubungan', required: true, options: [
          { value: 'pasangan', label: 'Pasangan' },
          { value: 'anak', label: 'Anak' },
          { value: 'orang_tua', label: 'Orang tua' },
          { value: 'lainnya', label: 'Lainnya' },
        ] },
      ],
    };
  }
  if (type === 'addon_group') {
    return { allow_multiple: true, items: [{ id: 'item_1', name: 'Item', sizes: [], price: 0, max_quantity: 10 }] };
  }
  if (type === 'payment_section') {
    return {
      required: false,
      payment_methods: ['bank_transfer', 'manual_qris'],
      payment_required_when: 'total_positive',
      proof_required: true,
      verify_with_ai: false,
      bank_accounts: [],
    };
  }
  if (type === 'rating') return { max: 5 };
  if (type === 'scale') return { min: 1, max_scale: 10 };
  return {};
}

function makeOption(position: number): FormOption {
  return { value: `option_${Date.now()}_${position}`, label: `Opsi ${position}` };
}

function moneyValue(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="mb-3">
        <h3 className="text-[11px] font-bold text-slate-800 dark:text-zinc-100">{title}</h3>
        {description && <p className="mt-0.5 text-[10px] leading-4 text-slate-400 dark:text-zinc-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.13em] text-slate-400 dark:text-zinc-500">{children}</span>;
}

export function FieldSettingsPanel({
  field,
  index,
  allFields,
  outcomes = [],
  onUpdate,
  onDuplicate,
  onDelete,
  onMove,
}: FieldSettingsPanelProps) {
  const supportsOptions = ['radio', 'checkbox', 'select', 'image_choice'].includes(field.type);
  const [uploadingReferenceId, setUploadingReferenceId] = useState<string | null>(null);
  const [uploadingOptionImageIndex, setUploadingOptionImageIndex] = useState<number | null>(null);
  const [uploadingQrisImage, setUploadingQrisImage] = useState(false);
  const conditionalParents = allFields
    .slice(0, index)
    .filter(candidate => ['radio', 'checkbox', 'select', 'image_choice'].includes(candidate.type) && candidate.options?.length);
  const selectedParent = conditionalParents.find(candidate => candidate.id === field.condition?.fieldId);
  const shouldShowReferenceImageTools = field.type !== 'payment_section' && (
    Boolean(field.reference_images?.length)
    || field.system_key === 'shirt_size'
    || /baju|kaos|shirt|size|ukuran|chart/i.test(field.label || '')
  );

  const updateOptions = (options: FormOption[]) => onUpdate({ options });
  const updateOption = (optionIndex: number, changes: Partial<FormOption>) => {
    const options = [...(field.options || [])];
    options[optionIndex] = { ...options[optionIndex], ...changes };
    updateOptions(options);
  };

  const uploadFieldImageAsset = async (file: File | undefined, label: string, folder: string, filePrefix: string) => {
    if (!file) return null;
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar.');
      return null;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Ukuran gambar maksimal 8MB. Kompres atau pilih gambar yang lebih ringan.');
      return null;
    }

    const toastId = toast.loading(`Mengoptimalkan ${label.toLowerCase()}...`);
    try {
      const optimizedImage = await imageCompression(file, {
        maxSizeMB: 0.9,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
        initialQuality: 0.82,
      });
      const uploadFile = optimizedImage as File;
      const fileExt = uploadFile.type.split('/')[1]?.replace('jpeg', 'jpg') || file.name.split('.').pop() || 'jpg';
      const safePrefix = filePrefix.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
      const filePath = `${folder}/${safePrefix}-${Date.now()}.${fileExt}`;
      toast.loading(`Mengunggah ${label.toLowerCase()}...`, { id: toastId });
      const { error: uploadError } = await supabase.storage
        .from('program-files')
        .upload(filePath, uploadFile, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('program-files').getPublicUrl(filePath);
      toast.success(`${label} berhasil diunggah`, { id: toastId });
      return publicUrl;
    } catch (error: any) {
      toast.error(error?.message || `Gagal mengunggah ${label.toLowerCase()}`, { id: toastId });
      return null;
    }
  };

  const updateReferenceImage = (slot: { id: string; label: string }, updates: Partial<FormReferenceImage>) => {
    const current = field.reference_images || [];
    const existing = current.find(reference => reference.id === slot.id);
    const nextReference: FormReferenceImage = {
      id: slot.id,
      label: existing?.label || slot.label,
      url: existing?.url || '',
      alt: existing?.alt || slot.label,
      ...updates,
    };
    const next = [
      ...current.filter(reference => reference.id !== slot.id),
      nextReference,
    ].filter(reference => reference.url.trim());
    onUpdate({ reference_images: next.length ? next : undefined });
  };

  const uploadReferenceImage = async (slot: { id: string; label: string }, file?: File) => {
    setUploadingReferenceId(slot.id);
    try {
      const safeSlot = slot.id.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
      const safeField = field.id.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
      const publicUrl = await uploadFieldImageAsset(file, slot.label, 'form-references', `${safeField}-${safeSlot}`);
      if (publicUrl) updateReferenceImage(slot, { url: publicUrl, alt: slot.label });
    } finally {
      setUploadingReferenceId(null);
    }
  };

  const uploadOptionImage = async (optionIndex: number, file?: File) => {
    setUploadingOptionImageIndex(optionIndex);
    try {
      const option = field.options?.[optionIndex];
      const safeField = field.id.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
      const publicUrl = await uploadFieldImageAsset(
        file,
        `Gambar opsi ${option?.label || optionIndex + 1}`,
        'form-option-images',
        `${safeField}-option-${optionIndex + 1}`,
      );
      if (publicUrl) updateOption(optionIndex, { image: publicUrl });
    } finally {
      setUploadingOptionImageIndex(null);
    }
  };

  const uploadQrisImage = async (file?: File) => {
    setUploadingQrisImage(true);
    try {
      const safeField = field.id.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
      const publicUrl = await uploadFieldImageAsset(file, 'Gambar QRIS', 'payment-qris', `${safeField}-qris`);
      if (publicUrl) onUpdate({ qris_image_url: publicUrl });
    } finally {
      setUploadingQrisImage(false);
    }
  };

  const togglePaymentMethod = (method: ManualPaymentMethod) => {
    const methods = field.payment_methods || [];
    onUpdate({
      payment_methods: methods.includes(method)
        ? methods.filter(current => current !== method)
        : [...methods, method],
    });
  };

  const updateBankAccount = (accountIndex: number, changes: Partial<BankAccountConfig>) => {
    const accounts = [...(field.bank_accounts || [])];
    accounts[accountIndex] = { ...accounts[accountIndex], ...changes };
    onUpdate({ bank_accounts: accounts });
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
          <Settings2 className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-400">Field {index + 1}</p>
          <h2 className="truncate text-sm font-bold text-slate-900 dark:text-white">Properti pertanyaan</h2>
        </div>
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={() => onMove('up')} disabled={index === 0} aria-label="Pindah ke atas" className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-800 disabled:opacity-25 dark:hover:bg-zinc-800 dark:hover:text-white"><ChevronUp className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => onMove('down')} disabled={index === allFields.length - 1} aria-label="Pindah ke bawah" className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-800 disabled:opacity-25 dark:hover:bg-zinc-800 dark:hover:text-white"><ChevronDown className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={onDuplicate} aria-label="Duplikasi pertanyaan" className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-800 dark:hover:bg-zinc-800 dark:hover:text-white"><Copy className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={onDelete} aria-label="Hapus pertanyaan" className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      <Section title="Konten" description="Perubahan muncul langsung di canvas.">
        <div className="space-y-3">
          <label><Label>Jenis field</Label><select value={field.type} onChange={event => onUpdate({ type: event.target.value as FieldType, ...typeDefaults(event.target.value as FieldType) })} className={CONTROL}>{FIELD_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
          <label><Label>Judul pertanyaan</Label><textarea rows={2} value={field.label} onChange={event => onUpdate({ label: event.target.value })} className={CONTROL} placeholder="Tulis pertanyaan" /></label>
          <label><Label>Petunjuk singkat</Label><textarea rows={2} value={field.description || ''} onChange={event => onUpdate({ description: event.target.value })} className={CONTROL} placeholder="Konteks untuk pengisi (opsional)" /></label>
          {['text', 'textarea', 'number'].includes(field.type) && <label><Label>Placeholder</Label><input value={field.placeholder || ''} onChange={event => onUpdate({ placeholder: event.target.value })} className={CONTROL} placeholder="Contoh jawaban" /></label>}
          <label><Label>Kunci automasi</Label><input value={field.system_key || ''} onChange={event => onUpdate({ system_key: event.target.value || undefined })} className={CONTROL} placeholder="contoh: attendance" /></label>
          {field.type !== 'payment_section' && (
            <button type="button" role="switch" aria-checked={field.required} onClick={() => onUpdate({ required: !field.required })} className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-left dark:border-zinc-700 dark:bg-zinc-900">
              <span><span className="block text-xs font-semibold text-slate-800 dark:text-zinc-200">Wajib diisi</span><span className="mt-0.5 block text-[10px] text-slate-400">Pengisi harus menjawab sebelum lanjut.</span></span>
              <span className={`relative h-6 w-11 rounded-full transition ${field.required ? 'bg-blue-600' : 'bg-slate-300 dark:bg-zinc-700'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${field.required ? 'translate-x-6' : 'translate-x-1'}`} /></span>
            </button>
          )}
        </div>
      </Section>

      {shouldShowReferenceImageTools && (
        <Section title="Gambar referensi" description="Upload langsung dari perangkat. Sistem otomatis mengompres gambar agar tetap cepat di mobile.">
          <div className="space-y-3">
            {REFERENCE_IMAGE_SLOTS.map(slot => {
              const reference = field.reference_images?.find(item => item.id === slot.id);
              return (
                <div key={slot.id} className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-zinc-700 dark:bg-zinc-900">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">
                      <ImageIcon className="h-3.5 w-3.5" /> {slot.label}
                    </span>
                    {reference?.url && (
                      <button type="button" onClick={() => updateReferenceImage(slot, { url: '' })} className="text-[10px] font-bold text-red-500 hover:text-red-600">
                        Hapus
                      </button>
                    )}
                  </div>
                  {reference?.url && (
                    <div className="mb-2 overflow-hidden rounded-lg border border-slate-100 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950">
                      <img src={reference.url} alt={reference.alt || slot.label} className="h-24 w-full object-contain" />
                    </div>
                  )}
                  <p className="mb-2 text-[10px] leading-4 text-slate-400 dark:text-zinc-500">{slot.helper}</p>
                  <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-blue-300 bg-blue-50/70 px-3 py-2 text-[11px] font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-300">
                    {uploadingReferenceId === slot.id ? <Settings2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {uploadingReferenceId === slot.id ? 'Mengunggah...' : reference?.url ? 'Ganti gambar' : 'Upload gambar'}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={event => {
                        void uploadReferenceImage(slot, event.target.files?.[0]);
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {supportsOptions && (
        <Section title="Opsi, harga & tujuan" description="Harga dan akhir alur dapat berbeda untuk setiap jawaban.">
          <div className="space-y-2.5">
            {(field.options || []).map((option, optionIndex) => (
              <div key={`${option.value}-${optionIndex}`} className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-zinc-700 dark:bg-zinc-900">
                <div className="grid grid-cols-[minmax(0,1fr)_88px_28px] gap-1.5">
                  <input value={option.label} onChange={event => updateOption(optionIndex, { label: event.target.value })} className={SMALL_CONTROL} aria-label={`Label opsi ${optionIndex + 1}`} />
                  <input type="number" min="0" value={option.price ?? 0} onChange={event => updateOption(optionIndex, { price: moneyValue(event.target.value) })} className={SMALL_CONTROL} aria-label={`Harga opsi ${optionIndex + 1}`} placeholder="Harga" />
                  <button type="button" onClick={() => updateOptions((field.options || []).filter((_, currentIndex) => currentIndex !== optionIndex))} aria-label={`Hapus opsi ${optionIndex + 1}`} className="flex items-center justify-center rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  <input value={option.value} onChange={event => updateOption(optionIndex, { value: event.target.value })} className={SMALL_CONTROL} aria-label={`Nilai opsi ${optionIndex + 1}`} placeholder="value" />
                  <select value={option.outcome_id || ''} onChange={event => updateOption(optionIndex, { outcome_id: event.target.value || undefined })} className={SMALL_CONTROL} aria-label={`Tujuan akhir opsi ${optionIndex + 1}`}>
                    <option value="">Lanjut ke pertanyaan berikut</option>
                    {outcomes.map(outcome => <option key={outcome.id} value={outcome.id}>Selesai: {outcome.title}</option>)}
                  </select>
                </div>
                {field.type === 'image_choice' && (
                  <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-2 dark:border-zinc-800 dark:bg-zinc-950/40">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-zinc-500">Gambar opsi</span>
                      {option.image && (
                        <button type="button" onClick={() => updateOption(optionIndex, { image: '' })} className="text-[10px] font-bold text-red-500 hover:text-red-600">
                          Hapus
                        </button>
                      )}
                    </div>
                    {option.image && (
                      <div className="mb-2 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
                        <img src={option.image} alt={option.label || `Opsi ${optionIndex + 1}`} className="h-24 w-full object-contain" />
                      </div>
                    )}
                    <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-fuchsia-300 bg-fuchsia-50/70 px-3 py-2 text-[11px] font-bold text-fuchsia-700 hover:bg-fuchsia-100 dark:border-fuchsia-900 dark:bg-fuchsia-950/20 dark:text-fuchsia-300">
                      {uploadingOptionImageIndex === optionIndex ? <Settings2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      {uploadingOptionImageIndex === optionIndex ? 'Mengunggah...' : option.image ? 'Ganti gambar opsi' : 'Upload gambar opsi'}
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={event => {
                          void uploadOptionImage(optionIndex, event.target.files?.[0]);
                          event.currentTarget.value = '';
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>
            ))}
            <button type="button" onClick={() => updateOptions([...(field.options || []), makeOption((field.options?.length || 0) + 1)])} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-blue-300 bg-blue-50/60 px-3 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-300"><Plus className="h-3.5 w-3.5" /> Tambah opsi</button>
          </div>
        </Section>
      )}

      {field.type === 'number' && (
        <Section title="Batas & kalkulasi" description="Gunakan harga per unit untuk kuantitas berbayar.">
          <div className="grid grid-cols-2 gap-2">
            <label><Label>Minimum</Label><input type="number" value={field.min ?? ''} onChange={event => onUpdate({ min: event.target.value === '' ? undefined : Number(event.target.value) })} className={CONTROL} /></label>
            <label><Label>Maksimum</Label><input type="number" value={field.max ?? ''} onChange={event => onUpdate({ max: event.target.value === '' ? undefined : Number(event.target.value) })} className={CONTROL} /></label>
            <label><Label>Kelipatan</Label><input type="number" min="0" value={field.step ?? 1} onChange={event => onUpdate({ step: Number(event.target.value) || 1 })} className={CONTROL} /></label>
            <label><Label>Harga / unit</Label><input type="number" min="0" value={field.unit_price ?? 0} onChange={event => onUpdate({ unit_price: moneyValue(event.target.value), currency: 'IDR' })} className={CONTROL} /></label>
          </div>
        </Section>
      )}

      {field.type === 'repeater' && (
        <Section title="Daftar anggota" description="Satu entri dapat menghasilkan satu tiket dan kupon terpisah.">
          <div className="grid grid-cols-2 gap-2">
            <label className="col-span-2"><Label>Nama item</Label><input value={field.item_label || ''} onChange={event => onUpdate({ item_label: event.target.value })} className={CONTROL} placeholder="Anggota keluarga" /></label>
            <label><Label>Minimum</Label><input type="number" min="0" value={field.min_items ?? 0} onChange={event => onUpdate({ min_items: Math.max(0, Number(event.target.value) || 0) })} className={CONTROL} /></label>
            <label><Label>Maksimum</Label><input type="number" min="1" value={field.max_items ?? 5} onChange={event => onUpdate({ max_items: Math.max(1, Number(event.target.value) || 1) })} className={CONTROL} /></label>
            <label className="col-span-2"><Label>Biaya per anggota</Label><input type="number" min="0" value={field.item_unit_price ?? 0} onChange={event => onUpdate({ item_unit_price: moneyValue(event.target.value), currency: 'IDR' })} className={CONTROL} /></label>
          </div>
          <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50/70 p-3 text-[10px] leading-5 text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/20 dark:text-violet-300"><Users className="mr-1.5 inline h-3.5 w-3.5" />Template menyimpan nama dan hubungan tiap anggota secara terpisah.</div>
        </Section>
      )}

      {field.type === 'addon_group' && (
        <Section title="Add-on checkout" description="Tambahkan fasilitas panitia seperti tenda atau matras. Semua harga dihitung ulang di server.">
          <div className="space-y-2">
            {(field.items || []).map((item, itemIndex) => (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-zinc-700 dark:bg-zinc-900">
                <div className="grid grid-cols-[minmax(0,1fr)_28px] gap-1.5">
                  <input value={item.name} onChange={event => { const items = [...(field.items || [])]; items[itemIndex] = { ...items[itemIndex], name: event.target.value }; onUpdate({ items }); }} className={SMALL_CONTROL} aria-label={`Nama item ${itemIndex + 1}`} placeholder="Contoh: Sewa tenda" />
                  <button type="button" onClick={() => onUpdate({ items: (field.items || []).filter((_, currentIndex) => currentIndex !== itemIndex) })} className="flex items-center justify-center rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500" aria-label={`Hapus item ${itemIndex + 1}`}><X className="h-3.5 w-3.5" /></button>
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  <label><Label>Harga / unit</Label><input type="number" min="0" value={item.price} onChange={event => { const items = [...(field.items || [])]; items[itemIndex] = { ...items[itemIndex], price: moneyValue(event.target.value) }; onUpdate({ items }); }} className={SMALL_CONTROL} aria-label={`Harga item ${itemIndex + 1}`} /></label>
                  <label><Label>Maks. jumlah</Label><input type="number" min="1" max="50" value={item.max_quantity ?? 10} onChange={event => { const items = [...(field.items || [])]; items[itemIndex] = { ...items[itemIndex], max_quantity: Math.min(50, Math.max(1, Number(event.target.value) || 1)) }; onUpdate({ items }); }} className={SMALL_CONTROL} aria-label={`Maksimum item ${itemIndex + 1}`} /></label>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => onUpdate({ items: [...(field.items || []), { id: `item_${Date.now()}`, name: 'Item baru', sizes: [], price: 0, max_quantity: 10 }] })} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-orange-300 px-3 py-2.5 text-xs font-bold text-orange-700"><Plus className="h-3.5 w-3.5" /> Tambah item</button>
          </div>
        </Section>
      )}

      {field.type === 'payment_section' && (
        <Section title="Pembayaran manual" description="Tiket ditahan sampai admin menyetujui bukti pembayaran.">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {([
                ['bank_transfer', 'Transfer bank'],
                ['manual_qris', 'QRIS manual'],
              ] as Array<[ManualPaymentMethod, string]>).map(([method, label]) => {
                const selected = field.payment_methods?.includes(method) ?? false;
                return <button key={method} type="button" onClick={() => togglePaymentMethod(method)} aria-pressed={selected} className={`flex items-center gap-2 rounded-xl border p-3 text-left text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${selected ? 'border-emerald-400 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300' : 'border-slate-200 bg-white text-slate-500 dark:border-zinc-700 dark:bg-zinc-900'}`}><span aria-hidden="true" className={`flex h-5 w-5 items-center justify-center rounded-md ${selected ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-zinc-800'}`}>{selected && <Check className="h-3 w-3" />}</span>{label}</button>;
              })}
            </div>
            {field.payment_methods?.includes('manual_qris') && (
              <div className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-zinc-700 dark:bg-zinc-900">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Label>Gambar QRIS</Label>
                  {field.qris_image_url && (
                    <button type="button" onClick={() => onUpdate({ qris_image_url: '' })} className="text-[10px] font-bold text-red-500 hover:text-red-600">
                      Hapus
                    </button>
                  )}
                </div>
                {field.qris_image_url && (
                  <div className="mb-2 overflow-hidden rounded-lg border border-slate-100 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950">
                    <img src={field.qris_image_url} alt="QRIS pembayaran" className="h-28 w-full object-contain" />
                  </div>
                )}
                <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-emerald-300 bg-emerald-50/70 px-3 py-2 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300">
                  {uploadingQrisImage ? <Settings2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {uploadingQrisImage ? 'Mengunggah...' : field.qris_image_url ? 'Ganti QRIS' : 'Upload QRIS'}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={event => {
                      void uploadQrisImage(event.target.files?.[0]);
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>
            )}
            {field.payment_methods?.includes('bank_transfer') && (
              <div className="space-y-2">
                {(field.bank_accounts || []).map((account, accountIndex) => (
                  <div key={account.id} className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-zinc-700 dark:bg-zinc-900">
                    <div className="grid grid-cols-[1fr_28px] gap-1.5"><input value={account.bank_name} onChange={event => updateBankAccount(accountIndex, { bank_name: event.target.value })} className={SMALL_CONTROL} placeholder="Nama bank" aria-label={`Nama bank rekening ${accountIndex + 1}`} /><button type="button" onClick={() => onUpdate({ bank_accounts: (field.bank_accounts || []).filter((_, currentIndex) => currentIndex !== accountIndex) })} className="flex items-center justify-center rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500" aria-label={`Hapus rekening ${accountIndex + 1}`}><X className="h-3.5 w-3.5" aria-hidden="true" /></button></div>
                    <div className="mt-1.5 grid grid-cols-1 gap-1.5 min-[280px]:grid-cols-2"><input value={account.account_number} onChange={event => updateBankAccount(accountIndex, { account_number: event.target.value })} className={SMALL_CONTROL} placeholder="Nomor rekening" aria-label={`Nomor rekening ${accountIndex + 1}`} /><input value={account.account_name} onChange={event => updateBankAccount(accountIndex, { account_name: event.target.value })} className={SMALL_CONTROL} placeholder="Atas nama" aria-label={`Pemilik rekening ${accountIndex + 1}`} /></div>
                  </div>
                ))}
                <button type="button" onClick={() => onUpdate({ bank_accounts: [...(field.bank_accounts || []), { id: `bank_${Date.now()}`, bank_name: '', account_number: '', account_name: '' }] })} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-emerald-300 px-3 py-2.5 text-xs font-bold text-emerald-700"><CreditCard className="h-3.5 w-3.5" /> Tambah rekening</button>
              </div>
            )}
            <label><Label>Instruksi pembayaran</Label><textarea rows={3} value={field.payment_description || ''} onChange={event => onUpdate({ payment_description: event.target.value })} className={CONTROL} placeholder="Instruksi untuk peserta" /></label>
          </div>
        </Section>
      )}

      <Section title="Logika tampil" description="Pertanyaan hanya muncul ketika jawaban sebelumnya cocok.">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-violet-600 dark:text-violet-400"><GitBranch className="h-3.5 w-3.5" /> Conditional logic</div>
          <select value={field.condition?.fieldId || ''} onChange={event => { const parent = conditionalParents.find(candidate => candidate.id === event.target.value); onUpdate({ condition: parent ? { fieldId: parent.id, operator: 'eq', value: parent.options?.[0]?.value || '' } : undefined }); }} className={CONTROL}>
            <option value="">Selalu tampil</option>
            {conditionalParents.map(parent => <option key={parent.id} value={parent.id}>Jika: {parent.label}</option>)}
          </select>
          {field.condition && selectedParent && (
            <div className="grid grid-cols-2 gap-2">
              <select value={field.condition.operator} onChange={event => onUpdate({ condition: { ...field.condition!, operator: event.target.value as 'eq' | 'neq' | 'in' } })} className={CONTROL}><option value="eq">sama dengan</option><option value="neq">tidak sama dengan</option><option value="in">salah satu dari</option></select>
              <select value={Array.isArray(field.condition.value) ? field.condition.value[0] || '' : field.condition.value} onChange={event => onUpdate({ condition: { ...field.condition!, value: field.condition!.operator === 'in' ? [event.target.value] : event.target.value } })} className={CONTROL}>{selectedParent.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
            </div>
          )}
          {conditionalParents.length === 0 && <p className="text-[10px] leading-5 text-slate-400">Tambahkan pertanyaan pilihan di atas field ini untuk membuat cabang.</p>}
        </div>
      </Section>
    </div>
  );
}

export default FieldSettingsPanel;
