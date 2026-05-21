import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Clock, Plus, Trash2, RefreshCw, Calendar, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export default function AdminStandbySchedule() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{ days: string[], time_start: string, time_end: string, officer_name: string, notes: string }>({ days: ['Senin'], time_start: '07:00', time_end: '16:00', officer_name: '', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchSchedules(); }, []);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('standby_schedules')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSchedules(data || []);
    } catch {
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.officer_name.trim()) {
      toast.error('Nama petugas wajib diisi');
      return;
    }
    try {
      setSaving(true);
      const payloads = form.days.map(d => ({
          day: d,
          time_start: form.time_start,
          time_end: form.time_end,
          officer_name: form.officer_name,
          notes: form.notes,
          created_at: new Date().toISOString()
        }));
        const { error } = await supabase.from('standby_schedules').insert(payloads);
      if (error) throw error;
      toast.success('Jadwal berhasil ditambahkan');
      setShowForm(false);
      setForm({ days: ['Senin'], time_start: '07:00', time_end: '16:00', officer_name: '', notes: '' });
      fetchSchedules();
    } catch (err: any) {
      toast.error('Gagal menyimpan: Pastikan tabel standby_schedules sudah ada di Supabase. ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Hapus jadwal ini?')) return;
    try {
      const { error } = await supabase.from('standby_schedules').delete().eq('id', id);
      if (error) throw error;
      setSchedules(prev => prev.filter(s => s.id !== id));
      toast.success('Jadwal dihapus');
    } catch (err: any) {
      toast.error('Gagal: ' + err.message);
    }
  };

  const todayName = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  const todaySchedules = schedules.filter(s => s.day === todayName);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Jadwal Standby</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
            Atur jadwal petugas yang standby di Koperasi/Kiosk
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchSchedules} className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 transition-colors shadow-sm">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-colors shadow-md shadow-blue-600/20">
            <Plus className="w-4 h-4" /> Tambah Jadwal
          </button>
        </div>
      </div>

      {/* Today's Schedule */}
      <div className={`rounded-2xl p-5 border ${todaySchedules.length > 0 ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800' : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'}`}>
        <div className="flex items-center gap-3 mb-3">
          {todaySchedules.length > 0 ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          )}
          <h3 className={`font-black text-sm ${todaySchedules.length > 0 ? 'text-emerald-800 dark:text-emerald-200' : 'text-amber-800 dark:text-amber-200'}`}>
            Hari Ini ({todayName}, {format(new Date(), 'dd MMM yyyy', { locale: id })})
          </h3>
        </div>
        {todaySchedules.length > 0 ? (
          <div className="space-y-2">
            {todaySchedules.map(s => (
              <p key={s.id} className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                {s.officer_name} · {s.time_start} – {s.time_end}
                {s.notes && <span className="font-normal opacity-70"> ({s.notes})</span>}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
            Belum ada petugas yang terjadwal hari ini. Kiosk menampilkan pesan "Restock Tutup Sementara" kepada pengguna.
          </p>
        )}
      </div>

      {/* Add Form */}
      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
          <h3 className="font-black text-zinc-900 dark:text-white">Tambah Jadwal Baru</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-500 mb-1.5">Hari</label>
              <select value={form.day} onChange={e => setForm(p => ({ ...p, day: e.target.value }))}
                className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500">
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 mb-1.5">Nama Petugas</label>
              <input type="text" value={form.officer_name} onChange={e => setForm(p => ({ ...p, officer_name: e.target.value }))}
                placeholder="Nama petugas standby"
                className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 mb-1.5">Jam Mulai</label>
              <input type="time" value={form.time_start} onChange={e => setForm(p => ({ ...p, time_start: e.target.value }))}
                className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 mb-1.5">Jam Selesai</label>
              <input type="time" value={form.time_end} onChange={e => setForm(p => ({ ...p, time_end: e.target.value }))}
                className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 mb-1.5">Catatan (opsional)</label>
            <input type="text" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Contoh: Lokasi kantin lantai 1"
              className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Simpan
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl font-bold text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
              Batal
            </button>
          </div>
        </motion.div>
      )}

      {/* Schedule List */}
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="bg-white dark:bg-zinc-900 rounded-2xl p-5 h-16 animate-pulse border border-zinc-100 dark:border-zinc-800" />)}</div>
      ) : schedules.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-12 text-center border border-zinc-100 dark:border-zinc-800">
          <Calendar className="w-12 h-12 text-zinc-200 dark:text-zinc-700 mx-auto mb-3" />
          <h3 className="text-lg font-black text-zinc-900 dark:text-white mb-1">Belum ada jadwal</h3>
          <p className="text-sm text-zinc-400 dark:text-zinc-500">Tambah jadwal petugas standby untuk mengaktifkan fitur restock.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
                {['Hari', 'Petugas', 'Jam', 'Catatan', ''].map(h => (
                  <th key={h} className="text-left px-5 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
              {schedules.map(s => (
                <tr key={s.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <td className="px-5 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${s.day === todayName ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                      {s.day}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm font-bold text-zinc-900 dark:text-white">{s.officer_name}</td>
                  <td className="px-5 py-4 text-sm text-zinc-600 dark:text-zinc-400 font-medium">{s.time_start} – {s.time_end}</td>
                  <td className="px-5 py-4 text-sm text-zinc-400 dark:text-zinc-500">{s.notes || '-'}</td>
                  <td className="px-5 py-4 text-right">
                    <button onClick={() => handleDelete(s.id)} className="p-1.5 text-zinc-300 hover:text-red-500 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
