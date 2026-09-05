import React, { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { appToast } from '../../../components/ui/AppToast';
import { FlaskConical, Upload, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';

export default function AdminAiTest() {
  const [imageBase64, setImageBase64] = useState<string>('');
  const [expectedAmount, setExpectedAmount] = useState<string>('8750');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      appToast.error('Format Salah', 'File harus berupa gambar (JPG/PNG).');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setImageBase64(reader.result as string);
      setResult(null);
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const runTest = async () => {
    if (!imageBase64) {
      appToast.error('Belum Ada Gambar', 'Silakan upload gambar struk terlebih dahulu.');
      return;
    }
    setLoading(true);
    setResult(null);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      const res = await fetch('/api/admin/ai/test-verify', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          image_base64: imageBase64,
          expected_amount: Number(expectedAmount) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menjalankan test');
      setResult(data);
    } catch (err: any) {
      setError(err?.message || 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
          <FlaskConical className="w-6 h-6 text-blue-500" />
          Test Verifikasi AI
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Uji verifikasi bukti pembayaran secara langsung. Tidak membuat transaksi, tidak mengubah data apapun.
        </p>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4">
        <div>
          <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
            Gambar Bukti Pembayaran
          </label>
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-6 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
            <Upload className="w-8 h-8 text-zinc-400 mb-2" />
            <span className="text-sm text-zinc-500">{imageBase64 ? 'Ganti gambar' : 'Klik untuk upload gambar struk'}</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
          </label>
          {imageBase64 && (
            <img src={imageBase64} alt="Preview" className="mt-3 max-h-64 rounded-lg border border-zinc-200 dark:border-zinc-700 mx-auto" />
          )}
        </div>

        <div>
          <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
            Nominal yang Harus Dibayar (Rp)
          </label>
          <input
            type="number"
            value={expectedAmount}
            onChange={(e) => setExpectedAmount(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
            placeholder="Contoh: 8750"
          />
        </div>

        <button
          onClick={runTest}
          disabled={loading || !imageBase64}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FlaskConical className="w-5 h-5" />}
          {loading ? 'Memproses AI...' : 'Jalankan Test'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-2xl p-4 text-red-700 dark:text-red-300 text-sm font-medium">
          {error}
        </div>
      )}

      {result && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-zinc-900 dark:text-white">Hasil Test</h2>
            <span className="text-xs text-zinc-400 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {result.duration_ms} ms
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-500">Model dipakai:</span>
            <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">{result.model_used}</code>
          </div>

          {result.parsed_result ? (
            <div className={`rounded-xl p-4 border ${result.parsed_result.isValid
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900'
              : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {result.parsed_result.isValid
                  ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  : <XCircle className="w-5 h-5 text-rose-600" />
                }
                <span className={`font-bold ${result.parsed_result.isValid ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                  {result.parsed_result.isValid ? 'VALID' : 'TIDAK VALID'}
                </span>
              </div>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">{result.parsed_result.reason}</p>
              {result.parsed_result.amountFound != null && (
                <p className="text-xs text-zinc-500 mt-2">Nominal terdeteksi: Rp {Number(result.parsed_result.amountFound).toLocaleString('id-ID')}</p>
              )}
            </div>
          ) : (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-4 text-sm text-amber-700 dark:text-amber-300">
              AI tidak mengembalikan hasil yang bisa dibaca. {result.parse_error && `Error: ${result.parse_error}`}
            </div>
          )}

          <details className="text-xs">
            <summary className="cursor-pointer text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 font-medium">Lihat respons mentah AI</summary>
            <pre className="mt-2 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-auto max-h-48 text-[10px] whitespace-pre-wrap break-all">{result.raw_response}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
