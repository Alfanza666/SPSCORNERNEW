import React from 'react';
import { FormField } from '../../types/form';
import { Star, DollarSign, Plus, QrCode, Building2, UsersRound } from 'lucide-react';

interface FieldRendererProps {
  field: FormField;
  themeColor: string;
  inputStyle: string;
  disabled?: boolean;
  value?: unknown;
  onChange?: (value: unknown) => void;
}

export default function FormFieldRenderer({ field, themeColor, inputStyle, disabled = false, value, onChange }: FieldRendererProps) {
  const styleObj = { '--theme-color': themeColor } as React.CSSProperties;
  const borderCls = inputStyle === 'rounded' ? 'rounded-lg border' : inputStyle === 'underline' ? 'border-b-2 border-t-0 border-l-0 border-r-0 bg-transparent px-1' : 'rounded-none border-2';

  const inputCls = `w-full px-4 py-2.5 text-sm transition-all outline-none ${borderCls} border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 text-zinc-900 dark:text-white focus:border-[var(--theme-color)] placeholder:text-zinc-400`;

  switch (field.type) {
    case 'text':
      return <input type="text" value={String(value ?? '')} onChange={(event) => onChange?.(event.target.value)} className={inputCls} style={styleObj} placeholder={field.placeholder || 'Masukkan jawaban...'} disabled={disabled} />;

    case 'textarea':
      return <textarea value={String(value ?? '')} onChange={(event) => onChange?.(event.target.value)} className={`${inputCls} h-24 resize-none`} style={styleObj} placeholder={field.placeholder || 'Masukkan paragraf...'} disabled={disabled} />;

    case 'number':
      return <input type="number" min={field.min} max={field.max} step={field.step} value={String(value ?? '')} onChange={(event) => onChange?.(event.target.value === '' ? '' : Number(event.target.value))} className={inputCls} style={styleObj} placeholder={field.placeholder || '0'} disabled={disabled} />;

    case 'date':
      return <input type="date" value={String(value ?? '')} onChange={(event) => onChange?.(event.target.value)} className={inputCls} style={styleObj} disabled={disabled} />;

    case 'select':
      return (
        <select value={String(value ?? '')} onChange={(event) => onChange?.(event.target.value)} className={inputCls} style={styleObj} disabled={disabled}>
          <option value="">Pilih...</option>
          {field.options?.map((o, i) => (
            <option key={i} value={o.value}>{o.label}{o.price ? ` (Rp${o.price.toLocaleString('id-ID')})` : ''}</option>
          ))}
        </select>
      );

    case 'radio':
      return (
        <div className="space-y-2" style={styleObj}>
          {field.options?.map((o, i) => (
            <label key={i} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all hover:border-[var(--theme-color)] ${value === o.value ? 'border-[var(--theme-color)] bg-zinc-50 dark:bg-zinc-800/70' : 'border-zinc-100 dark:border-zinc-800'}`}>
              <input type="radio" name={`preview-${field.id}`} value={o.value} checked={value === o.value} onChange={() => onChange?.(o.value)} disabled={disabled}
                className="text-[var(--theme-color)] focus:ring-[var(--theme-color)]" />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">{o.label}</span>
              {o.price ? <span className="text-xs font-medium text-zinc-500 ml-auto">+Rp{o.price.toLocaleString('id-ID')}</span> : null}
            </label>
          ))}
          {!field.options?.length && <p className="rounded-lg border border-dashed border-zinc-200 p-3 text-xs text-zinc-400 dark:border-zinc-700">Belum ada opsi jawaban.</p>}
        </div>
      );

    case 'checkbox':
      return (
        <div className="space-y-2" style={styleObj}>
          {field.options?.map((o, i) => (
            <label key={i} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all hover:border-[var(--theme-color)] ${Array.isArray(value) && value.includes(o.value) ? 'border-[var(--theme-color)] bg-zinc-50 dark:bg-zinc-800/70' : 'border-zinc-100 dark:border-zinc-800'}`}>
              <input type="checkbox" checked={Array.isArray(value) && value.includes(o.value)} onChange={(event) => {
                const current = Array.isArray(value) ? value : [];
                onChange?.(event.target.checked ? [...current, o.value] : current.filter(item => item !== o.value));
              }} disabled={disabled}
                className="rounded text-[var(--theme-color)] focus:ring-[var(--theme-color)]" />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">{o.label}</span>
              {o.price ? <span className="text-xs font-medium text-zinc-500 ml-auto">+Rp{o.price.toLocaleString('id-ID')}</span> : null}
            </label>
          ))}
          {!field.options?.length && <p className="rounded-lg border border-dashed border-zinc-200 p-3 text-xs text-zinc-400 dark:border-zinc-700">Belum ada opsi jawaban.</p>}
        </div>
      );

    case 'rating':
      return (
        <div className="flex flex-wrap gap-1.5" style={styleObj}>
          {[...Array(field.max || 5)].map((_, i) => (
            <button type="button" key={i} disabled={disabled} onClick={() => onChange?.(i + 1)}
              className={`p-1 transition-colors disabled:cursor-default ${Number(value) >= i + 1 ? 'text-yellow-400' : 'text-zinc-200 dark:text-zinc-700 hover:text-yellow-400'}`}>
              <Star className="w-7 h-7 fill-current" />
            </button>
          ))}
        </div>
      );

    case 'scale':
      return (
        <div className="flex flex-wrap gap-2" style={styleObj}>
          {[...Array(field.max_scale || 10)].map((_, i) => (
            <button type="button" key={i} disabled={disabled} onClick={() => onChange?.(i + 1)}
              className={`w-9 h-9 rounded-lg border bg-white dark:bg-zinc-800 flex items-center justify-center text-xs font-medium transition-all disabled:cursor-default ${Number(value) === i + 1 ? 'border-[var(--theme-color)] text-[var(--theme-color)] ring-2 ring-[var(--theme-color)]/20' : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-[var(--theme-color)] hover:text-[var(--theme-color)]'}`}>
              {i + 1}
            </button>
          ))}
        </div>
      );

    case 'file_upload':
      return (
        <label className="block cursor-pointer rounded-lg border-2 border-dashed border-zinc-200 p-5 text-center transition-colors hover:border-[var(--theme-color)] dark:border-zinc-700" style={styleObj}>
          <input
            type="file"
            className="sr-only"
            disabled={disabled}
            accept={field.allowed_types?.join(',')}
            onChange={(event) => onChange?.(event.target.files?.[0] || null)}
          />
          <UploadIcon className="w-7 h-7 mx-auto text-zinc-300 mb-1.5" />
          <p className="text-xs text-zinc-500">{value instanceof File ? value.name : `Upload File ${field.max_size_mb ? `(max ${field.max_size_mb}MB)` : ''}`}</p>
        </label>
      );

    case 'image':
      return (
        <label className="block cursor-pointer rounded-lg border-2 border-dashed border-zinc-200 p-5 text-center transition-colors hover:border-[var(--theme-color)] dark:border-zinc-700" style={styleObj}>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={disabled}
            onChange={(event) => onChange?.(event.target.files?.[0] || null)}
          />
          <ImageIconSvg className="w-7 h-7 mx-auto text-zinc-300 mb-1.5" />
          <p className="text-xs text-zinc-500">{value instanceof File ? value.name : 'Upload Gambar'}</p>
        </label>
      );

    case 'image_choice':
      return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2" style={styleObj}>
          {field.options?.map((o, i) => (
            <button type="button" key={i} disabled={disabled} onClick={() => onChange?.(o.value)} className={`text-left border rounded-lg overflow-hidden hover:border-[var(--theme-color)] cursor-pointer transition-all ${value === o.value ? 'border-[var(--theme-color)] ring-2 ring-[var(--theme-color)]/20' : 'border-zinc-200 dark:border-zinc-700'}`}>
              {o.image && <img src={o.image} alt={o.label} className="w-full h-20 object-cover" />}
              <div className="p-2 text-center">
                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{o.label}</p>
                {o.price ? <p className="text-[10px] text-zinc-500">Rp{o.price.toLocaleString('id-ID')}</p> : null}
              </div>
            </button>
          ))}
          {!field.options?.length && <p className="col-span-full rounded-lg border border-dashed border-zinc-200 p-3 text-center text-xs text-zinc-400 dark:border-zinc-700">Belum ada opsi gambar.</p>}
        </div>
      );

    case 'addon_group':
      return (
        <div className="space-y-2" style={styleObj}>
          {field.items?.map((item, i) => (
            <label key={i} className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-100 p-3 transition-colors hover:border-[var(--theme-color)] dark:border-zinc-800">
              <input type={field.allow_multiple ? 'checkbox' : 'radio'} disabled={disabled}
                name={`preview-addon-${field.id}`}
                checked={field.allow_multiple ? Array.isArray(value) && value.includes(item.id) : value === item.id}
                onChange={(event) => {
                  if (!field.allow_multiple) return onChange?.(item.id);
                  const current = Array.isArray(value) ? value : [];
                  onChange?.(event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id));
                }}
                className="text-[var(--theme-color)]" />
              <div className="flex-1">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{item.name}</p>
                <p className="text-[10px] text-zinc-400">Ukuran: {item.sizes.join(', ')}</p>
              </div>
              <p className="text-sm font-semibold text-[var(--theme-color)]">Rp{item.price.toLocaleString('id-ID')}</p>
            </label>
          ))}
        </div>
      );

    case 'repeater': {
      const entries = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-3" style={styleObj}>
          {entries.length > 0 ? entries.map((entry: any, index) => (
            <div key={entry?.id || index} className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/60">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-xs font-bold text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">{index + 1}</span>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-200">{entry?.name || `${field.item_label || 'Item'} ${index + 1}`}</p><p className="text-[10px] text-zinc-400">{entry?.relation || 'Detail diisi oleh peserta'}</p></div>
              {(field.item_unit_price || 0) > 0 && <span className="text-xs font-bold text-violet-600">Rp{(field.item_unit_price || 0).toLocaleString('id-ID')}</span>}
            </div>
          )) : (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-center dark:border-zinc-700 dark:bg-zinc-800/40"><UsersRound className="mx-auto h-6 w-6 text-zinc-300" /><p className="mt-2 text-xs font-medium text-zinc-500">Belum ada {field.item_label?.toLowerCase() || 'item'} ditambahkan</p></div>
          )}
          <button type="button" disabled={disabled} onClick={() => onChange?.([...entries, { id: `entry_${Date.now()}` }])} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-violet-300 bg-violet-50/60 px-3 py-3 text-xs font-bold text-violet-700 disabled:cursor-default disabled:opacity-70 dark:border-violet-900 dark:bg-violet-950/20 dark:text-violet-300"><Plus className="h-3.5 w-3.5" /> Tambah {field.item_label || 'item'}</button>
        </div>
      );
    }

    case 'payment_section':
      return (
        <div className="space-y-4 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 dark:border-emerald-900/50 dark:from-emerald-950/20 dark:to-zinc-900">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-500" />
            <span className="font-bold text-sm text-zinc-800 dark:text-zinc-200">Pembayaran manual</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {field.payment_methods?.includes('bank_transfer') && <div className="flex items-center gap-2 rounded-xl border border-white bg-white/80 p-3 text-xs font-semibold text-zinc-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"><Building2 className="h-4 w-4 text-emerald-600" /> Transfer bank</div>}
            {field.payment_methods?.includes('manual_qris') && <div className="flex items-center gap-2 rounded-xl border border-white bg-white/80 p-3 text-xs font-semibold text-zinc-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"><QrCode className="h-4 w-4 text-emerald-600" /> QRIS manual</div>}
          </div>
          <p className="text-xs leading-5 text-zinc-500">{field.payment_description || 'Peserta mengunggah bukti pembayaran untuk ditinjau admin.'}</p>
        </div>
      );

    default:
      return <div className="text-xs text-zinc-400 italic">Tipe: {field.type}</div>;
  }
}

function UploadIcon(props: any) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function ImageIconSvg(props: any) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}
