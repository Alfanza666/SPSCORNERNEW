import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Clock, Plus, Trash2, Loader2, Save, Calendar, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

const DAYS = [
  'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'
];

export default function AdminStandbySchedule() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newEntry, setNewEntry] = useState({
    day_of_week: 1,
    start_time: '08:00',
    end_time: '17:00'
  });

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('standby_schedules')
        .select('*')
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });
      
      if (error) throw error;
      setSchedules(data || []);
    } catch (error) {
      console.error('Error fetching schedules:', error);
      toast.error('Gagal memuat jadwal');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase
        .from('standby_schedules')
        .insert([newEntry]);
      
      if (error) throw error;
      
      toast.success('Jadwal ditambahkan!');
      fetchSchedules();
    } catch (error: any) {
      toast.error(`Gagal: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      const { error } = await supabase
        .from('standby_schedules')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast.success('Jadwal dihapus');
      fetchSchedules();
    } catch (error: any) {
      toast.error(`Gagal: ${error.message}`);
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    try {
      const { error } = await supabase
        .from('standby_schedules')
        .update({ is_active: !current })
        .eq('id', id);
      
      if (error) throw error;
      fetchSchedules();
    } catch (error: any) {
      toast.error(`Gagal: ${error.message}`);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-zinc-900 dark:text-white tracking-tight mb-2">Jadwal Standby</h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">Atur waktu standby Anggota Koperasi untuk mengaktifkan fitur Restock Seller.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Add Form */}
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-xl h-fit">
          <h2 className="text-xl font-black text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-500" /> Tambah Jadwal
          </h2>
          <form onSubmit={handleAddSchedule} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Hari</label>
              <select 
                value={newEntry.day_of_week}
                onChange={(e) => setNewEntry({...newEntry, day_of_week: parseInt(e.target.value)})}
                className="input-clay h-12"
              >
                {DAYS.map((day, i) => (
                  <option key={i} value={i}>{day}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Jam Mulai</label>
                <input 
                  type="time" 
                  value={newEntry.start_time}
                  onChange={(e) => setNewEntry({...newEntry, start_time: e.target.value})}
                  className="input-clay h-12"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Jam Selesai</label>
                <input 
                  type="time" 
                  value={newEntry.end_time}
                  onChange={(e) => setNewEntry({...newEntry, end_time: e.target.value})}
                  className="input-clay h-12"
                />
              </div>
            </div>
            <button 
              type="submit" 
              disabled={saving}
              className="btn-clay-primary w-full h-14 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Tambah Jadwal
            </button>
          </form>
        </div>

        {/* Schedule List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-blue-50/50 dark:bg-blue-900/10 p-6 rounded-[2rem] border border-blue-100 dark:border-blue-900/30 flex items-start gap-4">
            <Info className="w-6 h-6 text-blue-500 shrink-0 mt-1" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-blue-900 dark:text-blue-200">Info Operasional Unmanned Kiosk</p>
              <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                Fitur **Restock** di dashboard Seller hanya akan aktif pada rentang waktu yang Anda tentukan di bawah ini. Pastikan ada Anggota Koperasi yang bertugas di lokasi untuk melakukan verifikasi fisik saat Seller datang.
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest bg-zinc-50/50 dark:bg-zinc-800/50">
                    <th className="p-6">Hari</th>
                    <th className="p-6">Rentang Waktu</th>
                    <th className="p-6 text-center">Status</th>
                    <th className="p-6 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {schedules.map((s) => (
                    <tr key={s.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors group">
                      <td className="p-6 font-bold text-zinc-900 dark:text-white">
                        <div className="flex items-center gap-3">
                          <Calendar className="w-4 h-4 text-blue-500" />
                          {DAYS[s.day_of_week]}
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="flex items-center gap-2 font-mono font-black text-sm text-zinc-600 dark:text-zinc-300">
                          <Clock className="w-4 h-4 text-zinc-400" />
                          {s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}
                        </div>
                      </td>
                      <td className="p-6 text-center">
                        <button 
                          onClick={() => toggleActive(s.id, s.is_active)}
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                            s.is_active 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : 'bg-zinc-100 text-zinc-400'
                          }`}
                        >
                          {s.is_active ? 'Aktif' : 'Non-Aktif'}
                        </button>
                      </td>
                      <td className="p-6 text-right">
                        <button 
                          onClick={() => handleDeleteSchedule(s.id)}
                          className="w-10 h-10 clay-icon bg-white dark:bg-zinc-800 text-zinc-400 hover:text-red-600 transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {schedules.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-12 text-center text-zinc-400 font-medium italic">
                        Belum ada jadwal standby yang diatur.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
