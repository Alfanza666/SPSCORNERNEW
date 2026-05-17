import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/useAuthStore';
import { Gift, Users, Trophy, Clock, Download, Save, Loader2, Plus, X } from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import SpinWheel from '../../../components/ui/SpinWheel';

interface Program {
  id: string;
  name: string;
}

interface Participant {
  id: string;
  name: string;
  nik: string;
  couponCode: string;
}

interface Winner {
  id: string;
  winner_name: string;
  winner_nik: string;
  prize_name: string;
  draw_sequence: number;
  drawn_at: string;
}

export default function AdminDoorprizeSpin() {
  const { user } = useAuthStore();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<string>('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSpinning, setIsSpinning] = useState(false);
  const [prizeName, setPrizeName] = useState('');
  const [showPrizeInput, setShowPrizeInput] = useState(false);

  useEffect(() => {
    fetchPrograms();
  }, []);

  useEffect(() => {
    if (selectedProgram) {
      fetchParticipants();
      fetchWinners();
    }
  }, [selectedProgram]);

  const fetchPrograms = async () => {
    try {
      const { data, error } = await supabase
        .from('union_programs')
        .select('id, name')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setPrograms(data || []);
      if (data && data.length > 0) {
        setSelectedProgram(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching programs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchParticipants = async () => {
    try {
      // Get only active doorprize coupons (those who attended)
      const { data, error } = await supabase
        .from('program_coupons')
        .select('id, name, nik, qr_code, coupon_type')
        .eq('program_id', selectedProgram)
        .eq('coupon_type', 'doorprize')
        .eq('status', 'active');
      
      if (error) throw error;
      
      const mapped = (data || []).map(d => ({
        id: d.id,
        name: d.name,
        nik: d.nik,
        couponCode: d.qr_code
      }));
      setParticipants(mapped);
    } catch (error) {
      console.error('Error fetching participants:', error);
      toast.error('Gagal memuat peserta');
    }
  };

  const fetchWinners = async () => {
    try {
      const { data, error } = await supabase
        .from('program_doorprize_log')
        .select('*')
        .eq('program_id', selectedProgram)
        .order('draw_sequence', { ascending: true });
      
      if (error) throw error;
      setWinners(data || []);
    } catch (error) {
      console.error('Error fetching winners:', error);
    }
  };

  const handleSpinComplete = async (winner: Participant) => {
    if (!prizeName.trim()) {
      setShowPrizeInput(true);
      return;
    }

    await saveWinner(winner, prizeName);
  };

  const saveWinner = async (winner: Participant, prize: string) => {
    try {
      const response = await fetch(`/api/admin/programs/${selectedProgram}/draw-doorprize`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({ prizeName: prize })
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success(`Pemenang: ${result.data.winner_name}!`);
        setPrizeName('');
        setShowPrizeInput(false);
        fetchWinners();
        fetchParticipants(); // Remove winner from participants
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error('Save winner error:', error);
      toast.error(error.message || 'Gagal menyimpan pemenang');
    }
  };

  const handleExportLog = () => {
    const headers = ['No', 'Nama', 'NIK', 'Hadiah', 'Waktu'];
    const rows = winners.map(w => [
      w.draw_sequence, w.winner_name, w.winner_nik, w.prize_name,
      format(new Date(w.drawn_at), 'yyyy-MM-dd HH:mm')
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pemenang_doorprize_${selectedProgram}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-zinc-900 dark:text-white">
            Undian Doorprize
          </h1>
          <p className="text-sm text-zinc-500">Putar wheel untuk menentukan pemenang</p>
        </div>
        <div className="flex gap-2">
          <select
            value={selectedProgram}
            onChange={(e) => setSelectedProgram(e.target.value)}
            className="px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm"
          >
            {programs.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            onClick={handleExportLog}
            disabled={winners.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-400 text-white rounded-xl font-bold text-sm"
          >
            <Download className="w-4 h-4" />
            Export Log
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Wheel Section */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black flex items-center gap-2">
              <Gift className="w-5 h-5 text-purple-600" />
              Roda Undian
            </h2>
            <div className="flex items-center gap-2 text-sm font-bold text-zinc-500">
              <Users className="w-4 h-4" />
              {participants.length} peserta
            </div>
          </div>

          {participants.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Belum ada peserta dengan kupon doorprize aktif</p>
              <p className="text-sm mt-2">Pastikan peserta sudah scan attendance (Gate 1)</p>
            </div>
          ) : (
            <SpinWheel
              participants={participants}
              onWinnerSelected={handleSpinComplete}
              isSpinning={isSpinning}
              setIsSpinning={setIsSpinning}
            />
          )}

          {/* Prize Input */}
          {showPrizeInput && (
            <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
              <label className="block text-sm font-bold text-amber-800 dark:text-amber-200 mb-2">
                Nama Hadiah yang Diundi
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={prizeName}
                  onChange={(e) => setPrizeName(e.target.value)}
                  placeholder="Contoh: Jam Tangan, Rice Cooker, dll"
                  className="flex-1 px-4 py-2 border border-amber-300 dark:border-amber-700 rounded-xl"
                />
                <button
                  onClick={() => {
                    if (prizeName.trim()) {
                      saveWinner(participants[0], prizeName);
                    }
                  }}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl"
                >
                  <Save className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowPrizeInput(false)}
                  className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 font-bold rounded-xl"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Winners Log Section */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h2 className="text-lg font-black flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-amber-500" />
            Log Pemenang
          </h2>

          {winners.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Belum ada pemenang</p>
            </div>
          ) : (
            <div className="space-y-3">
              {winners.map((winner, idx) => (
                <motion.div
                  key={winner.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="flex items-center gap-4 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-xl border border-amber-200 dark:border-amber-800"
                >
                  <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-white font-black">
                    {winner.draw_sequence}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-zinc-900 dark:text-white">{winner.winner_name}</p>
                    <p className="text-xs font-mono text-zinc-500">NIK: {winner.winner_nik}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-amber-600 text-sm">{winner.prize_name}</p>
                    <p className="text-xs text-zinc-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(winner.drawn_at), 'HH:mm')}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}