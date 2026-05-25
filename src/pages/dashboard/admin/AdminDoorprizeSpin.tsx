import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/useAuthStore';
import { Gift, Users, Trophy, Clock, Save, Loader2, Play, Download, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

interface Program {
  id: string;
  name: string;
}

interface Participant {
  id: string;
  name: string;
  nik: string;
  coupon_code: string;
}

interface Winner {
  id: string;
  winner_name: string;
  winner_nik: string;
  prize_name: string;
  draw_sequence: number;
  drawn_at: string;
}

// Audio helpers
const playTick = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.05);
    gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch (e) {}
};

const playWin = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
    osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
    osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.3); // C6
    
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.0);
    
    osc.start();
    osc.stop(ctx.currentTime + 1.0);
  } catch (e) {}
};

export default function AdminDoorprizeSpin() {
  const { user } = useAuthStore();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<string>('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [prizeName, setPrizeName] = useState('');
  
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentDisplay, setCurrentDisplay] = useState<Participant | null>(null);
  const [finalWinner, setFinalWinner] = useState<Winner | null>(null);

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
      const { data, error } = await supabase
        .from('program_coupons')
        .select('id, name, nik, qr_code, coupon_type, status')
        .eq('program_id', selectedProgram)
        .eq('coupon_type', 'doorprize')
        .in('status', ['active', 'claimed']); 
        // Note: we might want to only draw from claimed (attended) or active
        // Let's assume everyone who has a doorprize coupon can win
      
      if (error) throw error;
      
      const mapped = (data || []).map(d => ({
        id: d.id,
        name: d.name,
        nik: d.nik,
        coupon_code: d.qr_code
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

  const handleStartSpin = () => {
    if (!selectedProgram) {
      toast.error('Pilih program terlebih dahulu');
      return;
    }
    if (!prizeName.trim()) {
      toast.error('Masukkan nama hadiah (contoh: TV LED 32 Inch)');
      return;
    }
    
    // Filter out previous winners
    const winnerNiks = winners.map(w => w.winner_nik);
    const eligible = participants.filter(p => !winnerNiks.includes(p.nik));
    
    if (eligible.length === 0) {
      toast.error('Tidak ada peserta yang memenuhi syarat (semua sudah menang atau data kosong)');
      return;
    }

    setIsSpinning(true);
    setFinalWinner(null);
    
    // Slot machine animation logic
    let duration = 5000; // 5 seconds spin
    let interval = 50;
    let startTime = Date.now();
    
    const spinEffect = setInterval(() => {
      const elapsed = Date.now() - startTime;
      
      if (elapsed > duration) {
        clearInterval(spinEffect);
        finishSpin(eligible);
      } else {
        // Slow down effect
        if (elapsed > duration * 0.7) interval = 150;
        if (elapsed > duration * 0.9) interval = 300;
        
        const randomParticipant = eligible[Math.floor(Math.random() * eligible.length)];
        setCurrentDisplay(randomParticipant);
        if (elapsed % 100 < 50) playTick();
      }
    }, interval);
  };

  const finishSpin = async (eligible: Participant[]) => {
    try {
        // Pick actual winner securely (or pseudo-randomly for now)
        const theWinner = eligible[Math.floor(Math.random() * eligible.length)];
        setCurrentDisplay(theWinner);
        
        // Save to database
        const { data, error } = await supabase.from('program_doorprize_log').insert({
            program_id: selectedProgram,
            winner_name: theWinner.name,
            winner_nik: theWinner.nik,
            prize_name: prizeName,
            draw_sequence: winners.length + 1
        }).select().single();

        if (error) throw error;
        
        playWin();
        setFinalWinner(data);
        fetchWinners(); // refresh winners
        
        // trigger confetti or vibrate
        if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);
        toast.success(`Selamat! ${theWinner.name} memenangkan ${prizeName}!`);
        
    } catch (e: any) {
        console.error(e);
        toast.error('Gagal menyimpan pemenang ke database');
    } finally {
        setIsSpinning(false);
    }
  };

  const handleExportLog = () => {
    if (winners.length === 0) {
      toast.error('Belum ada riwayat pemenang');
      return;
    }

    const data = winners.map(w => ({
      'Urutan Tarikan': w.draw_sequence,
      'Hadiah': w.prize_name,
      'Nama Pemenang': w.winner_name,
      'NIK': w.winner_nik,
      'Waktu Undian': format(new Date(w.drawn_at), 'dd MMM yyyy HH:mm:ss')
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pemenang Doorprize");
    XLSX.writeFile(wb, `Pemenang_Doorprize_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
  };

  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return <div className="p-8 text-center font-bold text-red-500">Akses Ditolak</div>;
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-zinc-900 dark:text-zinc-900 dark:text-white flex items-center gap-3">
            <Gift className="w-8 h-8 text-purple-500" />
            Undian Doorprize
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 font-medium">Acak pemenang doorprize dengan transparan</p>
        </div>
        
        {winners.length > 0 && (
          <button
            onClick={handleExportLog}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-700 dark:text-zinc-300 font-bold rounded-xl transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Data
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-200 dark:border-zinc-800 shadow-sm">
             <h3 className="text-sm font-black text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-purple-500" />
                Pengaturan Undian
             </h3>
             
             {loading ? (
                <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-purple-500" /></div>
             ) : (
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-700 dark:text-zinc-300 mb-2">Pilih Program</label>
                        <select
                            value={selectedProgram}
                            onChange={(e) => setSelectedProgram(e.target.value)}
                            disabled={isSpinning}
                            className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-purple-500/20 outline-none disabled:opacity-50"
                        >
                            <option value="">-- Pilih Program Aktif --</option>
                            {programs.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-700 dark:text-zinc-300 mb-2">Nama Hadiah / Doorprize</label>
                        <input
                            type="text"
                            value={prizeName}
                            onChange={(e) => setPrizeName(e.target.value)}
                            disabled={isSpinning}
                            placeholder="Contoh: Sepeda Motor"
                            className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-purple-500/20 outline-none disabled:opacity-50"
                        />
                    </div>
                    
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/50 p-4 rounded-xl flex items-center gap-3">
                        <Users className="w-8 h-8 text-purple-500 shrink-0" />
                        <div>
                            <div className="text-sm text-purple-700 dark:text-purple-400 font-bold">Total Peserta</div>
                            <div className="text-xl font-black text-purple-800 dark:text-purple-300">
                                {participants.length - winners.length} <span className="text-sm font-medium text-purple-600/70">Eligible</span>
                            </div>
                        </div>
                    </div>
                    
                    <button
                        onClick={handleStartSpin}
                        disabled={isSpinning || participants.length === 0}
                        className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-zinc-900 dark:text-white font-black rounded-xl shadow-lg shadow-purple-500/30 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 text-lg"
                    >
                        {isSpinning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                        {isSpinning ? 'Mengacak...' : 'Mulai Undian'}
                    </button>
                </div>
             )}
          </div>
        </div>

        {/* Display Area */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-900 dark:text-white rounded-[2.5rem] p-8 md:p-12 border-4 border-zinc-200 dark:border-zinc-800 relative overflow-hidden flex flex-col items-center justify-center min-h-[400px] shadow-2xl">
              {/* Background Accents */}
              <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/20 blur-[100px] rounded-full" />
              </div>
              
              {!currentDisplay && !finalWinner && (
                 <div className="text-center z-10">
                     <Gift className="w-24 h-24 text-zinc-800 mx-auto mb-4" />
                     <h2 className="text-2xl font-black text-zinc-600 uppercase tracking-widest">Siap Diundi</h2>
                     <p className="text-zinc-500">Masukkan nama hadiah dan tekan Mulai Undian</p>
                 </div>
              )}

              {(isSpinning || (currentDisplay && !finalWinner)) && (
                  <motion.div 
                     key={currentDisplay?.nik}
                     initial={{ opacity: 0, y: 50, scale: 0.9 }}
                     animate={{ opacity: 1, y: 0, scale: 1 }}
                     exit={{ opacity: 0, y: -50, scale: 0.9 }}
                     transition={{ duration: 0.1 }}
                     className="text-center z-10 w-full"
                  >
                      <h2 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-400 mb-4 truncate px-4">
                          {currentDisplay?.name || 'Mengacak...'}
                      </h2>
                      <div className="inline-block px-6 py-2 bg-purple-500/20 border border-purple-500/30 rounded-full">
                          <span className="font-mono text-xl md:text-2xl font-bold text-purple-400 tracking-widest">
                              {currentDisplay?.nik || '-------'}
                          </span>
                      </div>
                  </motion.div>
              )}

              {finalWinner && !isSpinning && (
                  <motion.div 
                     initial={{ opacity: 0, scale: 0.8 }}
                     animate={{ opacity: 1, scale: 1 }}
                     className="text-center z-10 w-full bg-gradient-to-b from-purple-900/50 to-transparent p-8 rounded-3xl border border-purple-500/30 backdrop-blur-sm"
                  >
                      <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                          <Sparkles className="w-10 h-10 text-purple-400" />
                      </div>
                      <p className="text-purple-300 font-bold uppercase tracking-[0.2em] mb-2 text-sm">Selamat Kepada Pemenang</p>
                      <h2 className="text-4xl md:text-5xl font-black text-zinc-900 dark:text-white mb-4 drop-shadow-lg truncate">
                          {finalWinner.winner_name}
                      </h2>
                      <div className="inline-block px-6 py-2 bg-zinc-100 dark:bg-black/50 border border-zinc-200 dark:border-zinc-700 rounded-full mb-6">
                          <span className="font-mono text-xl font-bold text-zinc-700 dark:text-zinc-300 tracking-widest">
                              {finalWinner.winner_nik}
                          </span>
                      </div>
                      <div className="bg-purple-600 text-zinc-900 dark:text-white px-6 py-3 rounded-xl inline-block shadow-[0_0_20px_rgba(147,51,234,0.4)]">
                          <span className="font-bold">Mendapatkan: </span> 
                          <span className="font-black text-lg ml-1">{finalWinner.prize_name}</span>
                      </div>
                  </motion.div>
              )}
          </div>
          
          {/* Recent Winners List */}
          {winners.length > 0 && (
             <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-200 dark:border-zinc-800 shadow-sm">
                 <h3 className="text-sm font-black text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Riwayat Pemenang
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                     {winners.map((w, i) => (
                         <div key={w.id} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-200 dark:border-zinc-700/50 rounded-2xl">
                             <div className="flex items-center gap-3 min-w-0">
                                 <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-black flex items-center justify-center shrink-0">
                                     #{i + 1}
                                 </div>
                                 <div className="min-w-0">
                                     <p className="font-bold text-zinc-900 dark:text-zinc-900 dark:text-white truncate">{w.winner_name}</p>
                                     <p className="text-xs text-zinc-500 truncate">{w.winner_nik} • {w.prize_name}</p>
                                 </div>
                             </div>
                         </div>
                     ))}
                 </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
