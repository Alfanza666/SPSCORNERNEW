import { useEffect, useState } from 'react';
import { CreditCard, Upload, Loader2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/useAuthStore';

export default function AdminPayments() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [qrisUrl, setQrisUrl] = useState('');
  const [methods, setMethods] = useState({ qrisDynamic: true, qrisManual: true, vaBca: false, vaMandiri: false, redirect: true });
  const isSuperadmin = user?.role === 'superadmin';

  useEffect(() => { void load(); }, []);
  const load = async () => {
    const { data } = await supabase.from('settings').select('key,value').in('key', ['qris_image_url','payment_method_qris_dynamic','payment_method_qris_manual','payment_method_va_bca','payment_method_va_mandiri','payment_method_redirect']);
    const get = (key: string, fallback: boolean) => data?.find(x => x.key === key)?.value === 'true' || fallback;
    setQrisUrl(data?.find(x => x.key === 'qris_image_url')?.value || '');
    setMethods({ qrisDynamic: get('payment_method_qris_dynamic', true), qrisManual: get('payment_method_qris_manual', true), vaBca: get('payment_method_va_bca', false), vaMandiri: get('payment_method_va_mandiri', false), redirect: get('payment_method_redirect', true) });
    setLoading(false);
  };
  const save = async (key: string, value: string) => { setSaving(true); const { error } = await supabase.from('settings').upsert({ key, value, updated_at: new Date().toISOString() }); setSaving(false); if (error) toast.error('Gagal menyimpan'); else toast.success('Pengaturan disimpan'); };
  const uploadQris = async (file?: File) => { if (!file || file.size > 2 * 1024 * 1024) return toast.error('File QRIS maksimal 2MB'); setUploading(true); try { const path = `settings/qris_${Date.now()}.${file.name.split('.').pop()}`; const { error } = await supabase.storage.from('products').upload(path, file, { upsert: false, cacheControl: '3600' }); if (error) throw error; const { data } = supabase.storage.from('products').getPublicUrl(path); setQrisUrl(data.publicUrl); await save('qris_image_url', data.publicUrl); } catch (e: any) { toast.error(e.message || 'Gagal mengunggah QRIS'); } finally { setUploading(false); } };
  if (loading) return <div className="p-8 text-center">Memuat metode pembayaran...</div>;
  if (!isSuperadmin) return <div className="p-8 text-center text-red-600">Akses hanya untuk superadmin.</div>;
  const items = [['qrisDynamic','QRIS Dinamis','Pembayaran otomatis'],['qrisManual','QRIS Statis','Upload bukti pembayaran'],['vaBca','VA BCA','Virtual Account BCA'],['vaMandiri','VA Mandiri','Virtual Account Mandiri'],['redirect','iPaymu Redirect','Metode pembayaran lainnya']] as const;
  return <div className="space-y-8"><div><h1 className="text-2xl font-black text-zinc-900 dark:text-white">Metode Pembayaran</h1><p className="text-sm text-zinc-500">Kelola metode pembayaran secara terpisah dari pengaturan umum.</p></div><section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"><h2 className="mb-5 flex items-center gap-2 text-xl font-bold"><CreditCard className="h-5 w-5 text-blue-600" /> Metode Aktif</h2><div className="grid gap-4 sm:grid-cols-2">{items.map(([key,label,desc]) => <div key={key} className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50"><div><p className="font-bold">{label}</p><p className="text-xs text-zinc-500">{desc}</p></div><button disabled={saving} onClick={() => { const value = !methods[key]; setMethods(m => ({...m,[key]:value})); void save(`payment_method_${key === 'qrisDynamic' ? 'qris_dynamic' : key === 'qrisManual' ? 'qris_manual' : key === 'vaBca' ? 'va_bca' : key === 'vaMandiri' ? 'va_mandiri' : 'redirect'}`, String(value)); }} className={`relative h-6 w-11 rounded-full ${methods[key] ? 'bg-blue-600' : 'bg-zinc-300'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white ${methods[key] ? 'left-6' : 'left-1'}`} /></button></div>)}</div></section><section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"><h2 className="mb-2 flex items-center gap-2 text-xl font-bold"><Upload className="h-5 w-5 text-emerald-600" /> QRIS Statis</h2><p className="mb-4 text-sm text-zinc-500">Upload QRIS statis yang ditampilkan untuk pembayaran manual.</p>{qrisUrl && <img src={qrisUrl} alt="QRIS statis aktif" className="mb-4 h-56 w-full rounded-2xl bg-zinc-50 object-contain" />}<label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {uploading ? 'Mengunggah...' : 'Upload QRIS'}<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => void uploadQris(e.target.files?.[0])} /></label></section></div>;
}
