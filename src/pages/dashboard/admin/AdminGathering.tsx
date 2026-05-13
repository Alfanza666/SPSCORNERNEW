import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { FileText, DollarSign, CheckCircle, Loader2, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { exportExcel } from '../../../lib/utils'; 

export default function AdminGathering() {
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResponses();
  }, []);

  const fetchResponses = async () => {
    try {
      const { data } = await supabase
        .from('program_responses')
        .select('*, union_programs(name), profiles(name, nik)')
        .order('created_at', { ascending: false });
      if (data) setResponses(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprovePayment = async (responseId: string) => {
    try {
      const { error } = await supabase
        .from('program_responses')
        .update({ payment_status: 'paid' })
        .eq('id', responseId);
      if (error) throw error;
      toast.success('Pembayaran keluarga tambahan disetujui!');
      fetchResponses();
    } catch (error) {
      toast.error('Gagal menyetujui pembayaran');
    }
  };

  // --- LOGIKA EXCEL DINAMIS ---
  const handleExport = () => {
    if (responses.length === 0) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }

    // 1. Ekstrak semua kunci pertanyaan (label form) yang ada dari seluruh jawaban
    const allFormKeys = new Set<string>();
    responses.forEach(r => {
      if (r.answers) Object.keys(r.answers).forEach(key => allFormKeys.add(key));
    });
    const dynamicHeaders = Array.from(allFormKeys);

    // 2. Susun Header Excel
    const headers = [
      'Program', 'NIK', 'Nama Karyawan', ...dynamicHeaders, 
      'Keluarga Tambahan', 'Total Biaya', 'Status Bayar', 'Tanggal Submit'
    ];

    // 3. Susun Baris Data Excel
    const rows = responses.map(r => [
      r.union_programs?.name || '-',
      r.profiles?.nik || '-',
      r.profiles?.name || '-',
      ...dynamicHeaders.map(key => r.answers ? r.answers[key] || '-' : '-'), // Petakan jawaban ke kolom yang tepat
      r.additional_family,
      r.total_fee,
      r.payment_status,
      new Date(r.created_at).toLocaleString('id-ID')
    ]);

    // 4. Proses Download
    exportExcel(headers, rows, `Laporan_Formulir_SPS_${new Date().getTime()}`, 'Data Respons');
    toast.success("Excel Berhasil Diunduh!");
  };

  return (
    <div className="p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white flex items-center gap-2"><FileText className="w-6 h-6"/> Monitor Survei & Form</h1>
          <p className="text-sm text-zinc-500">Pantau jawaban formulir dinamis dari karyawan</p>
        </div>
        <button 
          onClick={handleExport} 
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-green-600/30"
        >
          <Download className="w-5 h-5"/> Export Excel
        </button>
      </div>

      {loading ? <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600"/> : (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-50 dark:bg-zinc-950 text-xs uppercase font-bold text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-6 py-4">Karyawan</th>
                  <th className="px-6 py-4">Program</th>
                  <th className="px-6 py-4">Jawaban Formulir</th>
                  <th className="px-6 py-4 text-center">Tmbhn. Keluarga</th>
                  <th className="px-6 py-4">Pembayaran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {responses.map((resp) => (
                  <tr key={resp.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="px-6 py-4">
                      <p className="font-bold text-zinc-900 dark:text-white">{resp.profiles?.name}</p>
                      <p className="text-[10px] text-zinc-500 font-mono">{resp.profiles?.nik}</p>
                    </td>
                    <td className="px-6 py-4 font-bold text-blue-600">{resp.union_programs?.name}</td>
                    
                    {/* Jawaban Dinamis di Render sebagai List di UI agar rapi */}
                    <td className="px-6 py-4">
                      {resp.answers && Object.keys(resp.answers).length > 0 ? (
                        <ul className="space-y-1 text-xs bg-zinc-50 dark:bg-zinc-950 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                          {Object.entries(resp.answers).map(([key, val]) => (
                            <li key={key}><span className="font-bold text-zinc-500">{key}:</span> {String(val)}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-xs text-zinc-400 italic">Tidak ada form khusus</span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-center font-black text-lg">{resp.additional_family}</td>
                    
                    <td className="px-6 py-4">
                      {resp.additional_family > 0 ? (
                        <div>
                          <p className="font-bold text-red-600 mb-1">Rp {resp.total_fee?.toLocaleString('id-ID')}</p>
                          {resp.payment_status === 'pending' ? (
                            <button 
                              onClick={() => handleApprovePayment(resp.id)}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 w-full justify-center"
                            >
                              <DollarSign className="w-3 h-3"/> Setujui Bayar
                            </button>
                          ) : (
                            <div className="flex items-center gap-1 text-green-600 text-[10px] font-bold bg-green-100 px-2 py-1 rounded-lg w-fit">
                              <CheckCircle className="w-3 h-3"/> LUNAS
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-zinc-400 font-bold uppercase bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-md">Gratis</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
