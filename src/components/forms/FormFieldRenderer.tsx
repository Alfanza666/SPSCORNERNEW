import React from 'react';
import { FormField } from '../../types/form';
import { Star, DollarSign } from 'lucide-react';

interface FieldRendererProps {
  field: FormField;
  themeColor: string;
  inputStyle: string;
  disabled?: boolean;
  value?: any;
  onChange?: (value: any) => void;
}

const getInputCls = (inputStyle: string, themeColor: string, isCard: boolean) => {
  let base = "w-full p-3 text-sm focus:outline-none transition-all";
  let borderStyle = "";
  if (inputStyle === 'rounded') {
    borderStyle = "border border-zinc-300 dark:border-zinc-600 rounded-xl focus:border-[var(--theme-color)]";
  } else if (inputStyle === 'underline') {
    borderStyle = "border-b-2 border-t-0 border-l-0 border-r-0 border-zinc-250 dark:border-zinc-600 bg-transparent px-1 focus:border-[var(--theme-color)]";
  } else {
    borderStyle = "border-2 border-zinc-150 dark:border-zinc-700 rounded-none focus:border-[var(--theme-color)]";
  }
  return `${base} ${borderStyle} bg-white dark:bg-zinc-800/80 text-zinc-900 dark:text-white`;
};

export default function FormFieldRenderer({ field, themeColor, inputStyle, disabled }: FieldRendererProps) {
  const inputCls = getInputCls(inputStyle, themeColor, false);
  const styleObj = { '--theme-color': themeColor } as React.CSSProperties;

  switch (field.type) {
    case 'text':
      return (
        <input
          type="text"
          className={inputCls}
          style={styleObj}
          placeholder={field.placeholder || 'Masukkan jawaban singkat...'}
          disabled={disabled}
        />
      );

    case 'textarea':
      return (
        <textarea
          className={`${inputCls} h-20 resize-none`}
          style={styleObj}
          placeholder={field.placeholder || 'Masukkan paragraf...'}
          disabled={disabled}
        />
      );

    case 'number':
      return (
        <input
          type="number"
          className={inputCls}
          style={styleObj}
          placeholder={field.placeholder || 'Masukkan angka...'}
          disabled={disabled}
        />
      );

    case 'date':
      return (
        <input type="date" className={inputCls} style={styleObj} disabled={disabled} />
      );

    case 'select':
      return (
        <select className={inputCls} style={styleObj} disabled={disabled}>
          <option value="">Pilih opsi...</option>
          {field.options?.map((o, idx) => (
            <option key={idx} value={o.value}>{o.label}{o.price ? ` (Rp${o.price.toLocaleString('id-ID')})` : ''}</option>
          ))}
        </select>
      );

    case 'radio':
      return (
        <div className="space-y-3">
          {field.options?.map((o, idx) => (
            <label key={idx} className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-[var(--theme-color)] cursor-pointer transition-colors">
              <input type="radio" name={field.id} disabled={disabled} className="text-[var(--theme-color)] focus:ring-[var(--theme-color)]" />
              <span className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">{o.label}</span>
              {o.price ? <span className="text-xs font-bold text-zinc-500 ml-auto">+Rp{o.price.toLocaleString('id-ID')}</span> : null}
            </label>
          ))}
        </div>
      );

    case 'checkbox':
      return (
        <div className="space-y-3">
          {field.options?.map((o, idx) => (
            <label key={idx} className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-[var(--theme-color)] cursor-pointer transition-colors">
              <input type="checkbox" disabled={disabled} className="rounded text-[var(--theme-color)] focus:ring-[var(--theme-color)]" />
              <span className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">{o.label}</span>
              {o.price ? <span className="text-xs font-bold text-zinc-500 ml-auto">+Rp{o.price.toLocaleString('id-ID')}</span> : null}
            </label>
          ))}
        </div>
      );

    case 'rating':
      return (
        <div className="flex gap-1.5">
          {[...Array(field.max || 5)].map((_, i) => (
            <button
              key={i}
              disabled={disabled}
              className="p-1 text-zinc-300 dark:text-zinc-600 hover:text-yellow-400 transition-colors disabled:cursor-not-allowed"
            >
              <Star className="w-7 h-7 fill-current" />
            </button>
          ))}
        </div>
      );

    case 'scale':
      return (
        <div className="flex gap-2 flex-wrap">
          {[...Array(field.max_scale || 10)].map((_, i) => (
            <button
              key={i}
              disabled={disabled}
              className="w-10 h-10 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:border-[var(--theme-color)] hover:text-[var(--theme-color)] transition-all disabled:cursor-not-allowed"
            >
              {i + 1}
            </button>
          ))}
        </div>
      );

    case 'file_upload':
      return (
        <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-xl p-6 text-center hover:border-[var(--theme-color)] transition-colors cursor-pointer">
          <Upload className="w-8 h-8 mx-auto text-zinc-400 mb-2" />
          <p className="text-xs text-zinc-500 font-medium">Upload File {field.max_size_mb ? `(Maks ${field.max_size_mb}MB)` : ''}</p>
        </div>
      );

    case 'image':
      return (
        <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-xl p-6 text-center hover:border-[var(--theme-color)] transition-colors cursor-pointer">
          <ImageIcon className="w-8 h-8 mx-auto text-zinc-400 mb-2" />
          <p className="text-xs text-zinc-500 font-medium">Upload Gambar</p>
        </div>
      );

    case 'image_choice':
      return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {field.options?.map((o, idx) => (
            <div key={idx} className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden hover:border-[var(--theme-color)] cursor-pointer transition-all">
              {o.image && <img src={o.image} alt={o.label} className="w-full h-24 object-cover" />}
              <div className="p-2 text-center">
                <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{o.label}</p>
                {o.price ? <p className="text-[10px] text-zinc-500">Rp{o.price.toLocaleString('id-ID')}</p> : null}
              </div>
            </div>
          ))}
        </div>
      );

    case 'addon_group':
      return (
        <div className="space-y-3">
          {field.items?.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <input type={field.allow_multiple ? 'checkbox' : 'radio'} disabled={disabled} className="text-[var(--theme-color)]" />
              <div className="flex-1">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{item.name}</p>
                <p className="text-[10px] text-zinc-500">Ukuran: {item.sizes.join(', ')}</p>
              </div>
              <p className="text-sm font-bold text-[var(--theme-color)]">Rp{item.price.toLocaleString('id-ID')}</p>
            </div>
          ))}
        </div>
      );

    case 'payment_section':
      return (
        <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl p-5 space-y-4 bg-white dark:bg-zinc-800/50">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-500" />
            <span className="font-bold text-sm text-zinc-800 dark:text-zinc-200">Pembayaran</span>
          </div>
          {field.qris_image_url && (
            <img src={field.qris_image_url} alt="QRIS" className="w-40 h-40 object-contain mx-auto rounded-lg border" />
          )}
          <div className="text-xs text-zinc-500 space-y-1">
            <p><span className="font-bold">Rekening:</span> {field.account_name || 'Admin SPS'}</p>
            <p><span className="font-bold">Keterangan:</span> {field.payment_description || 'Transfer ke rekening di atas'}</p>
          </div>
        </div>
      );

    default:
      return <div className="text-xs text-zinc-400 italic">Tipe field tidak dikenal: {field.type}</div>;
  }
}

function Upload(props: any) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function ImageIcon(props: any) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}
