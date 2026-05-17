import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { 
  Gift, Play, Trophy, Users, Loader2, RotateCw, History, Award, CheckCircle 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

interface WinnerLog {
  id: string;
  winner_name: string;
  winner_nik: string;
  prize_name: string;
  created_at: string;
}

export default function AdminDoorprize() {
  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [eligibleCount, setEligibleCount] = useState(0);
  
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState<any | null>(null);
  const [currentName, setCurrentName] = useState<string>('Siap Mengacak...');
  const [prizeName, setPrizeName] = useState('');
  const [winnerLogs, setWinnerLogs] = useState<WinnerLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    fetchPrograms();
  }, []);

  useEffect(() => {
    if (selectedProgramId) {
      checkEligible();
      fetchLogs();
    }
  }, [selectedProgramId]);

  const fetchPrograms = async () => {
    const { data } = await supabase.from('union_programs').select('id, name').order('created_at', { ascending: false });
    if (data) {
        setPrograms(data);
        if (data.length > 0) setSelectedProgramId(data[0].id);
    }
  };

  const checkEligible = async () => {
    // Count active doorprize coupons for this program
    const { count } = await supabase
      .from('program_coupons')
      .select('*', { count: 'exact', head: true })
      .eq('program_id', selectedProgramId)
      .eq('gate_type', 'doorprize')
      .eq('status', 'active');
      
    setEligibleCount(count || 0);
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    const { data } = await supabase
      .from('program_doorprize_log')
      .select('*')
      .eq('program_id', selectedProgramId)
      .order('created_at', { ascending: false });
      
    if (data) setWinnerLogs(data);
    setLoadingLogs(false);
  };

  const handleSpin = async () => {
    if (!prizeName) {
        toast.error("Masukkan nama hadiah terlebih dahulu!");
        return;
    }
    if (eligibleCount === 0) {
        toast.error("Tidak ada kupon doorprize aktif untuk diundi!");
        return;
    }

    setIsSpinning(true);
    setWinner(null);

    // Simulate spinning animation
    let iterations = 0;
    const maxIterations = 20;
    const interval = setInterval(async () => {
        // Fetch random to simulate movement? 
        // Ideally just shake UI, but let's fetch a random one to show name changing
        const { data: randomPerson } = await supabase
            .from('program_coupons')
            .select('name, nik')
            .eq('program_id', selectedProgramId)
            .eq('gate_type', 'doorprize')
            .eq('status', 'active')
            .limit(1)
            .single(); // This isn't truly random every time, but good for visual effect if we had more logic. 
            // Actually simpler: just show "Mengundi..." 
            
        setCurrentName("Mengundi "+ (Math.random() * 100).toFixed(0) + "...");
        
        iterations++;
        if (iterations >= maxIterations) {
            clearInterval(interval);
            performDraw();
        }
    }, 100);
  };

  const performDraw = async () => {
    try {
        // 1. Pick a winner randomly from DB
        const { data: winnerCoupon, error } = await supabase
            .from('program_coupons')
            .select('*')
            .eq('program_id', selectedProgramId)
            .eq('gate_type', 'doorprize')
            .eq('status', 'active')
            .limit(1)
            .single(); // .single() forces one row, but NOT random. We need random.

        // To do random properly in Supabase without random() function exposed easily:
        // We can fetch all, pick one in JS. (Ok for small sets, bad for large).
        // Let's assume set is small for now or use raw query if needed. 
        // Better: just fetch all active, pick random index.
        
        const { data: allCoupons } = await supabase
            .from('program_coupons')
            .select('id, name, nik')
            .eq('program_id', selectedProgramId)
            .eq('gate_type', 'doorprize')
            .eq('status', 'active');

        if (!allCoupons || allCoupons.length === 0) {
            toast.error("Gagal mengambil data kupon.");
            setIsSpinning(false);
            return;
        }

        const winnerIndex = Math.floor(Math.random() * allCoupons.length);
        const finalWinner = allCoupons[winnerIndex];

        // 2. Mark as claimed (or won)
        await supabase
            .from('program_coupons')
            .update({ status: 'claimed', claimed_at: new Date().toISOString() })
            .eq('id', finalWinner.id);

        // 3. Log to database
        const { error: logError } = await supabase
            .from('program_doorprize_log')
            .insert({
                program_id: selectedProgramId,
                coupon_id: finalWinner.id,
                winner_name: finalWinner.name,
                winner_nik: finalWinner.nik,
                prize_name: prizeName
            });

        if (logError) throw logError;

        setWinner(finalWinner);
        setCurrentName(finalWinner.name);
        toast.success(`Pemenang: ${finalWinner.name} (${finalWinner.nik})`);
        checkEligible(); // Update count
        fetchLogs(); // Refresh log
    } catch (err: any) {
        toast.error(err.message);
    } finally {
        setIsSpinning(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-black flex items-center gap-3 mb-8">
            <Gift className="w-8 h-8 text-amber-400" />
            Doorprize Manager
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* LEFT COL: Controls & Wheel */}
            <div className="lg:col-span-2 space-y-6">
                {/* Select Program */}
                <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800">
                    <label className="block text-sm font-bold text-zinc-400 mb-2">PILIH PROGRAM</label>
                    <select 
                        value={selectedProgramId}
                        onChange={(e) => setSelectedProgramId(e.target.value)}
                        className="w-full bg-zinc-800 border-none rounded-xl p-4 font-bold text-lg focus:ring-2 focus:ring-amber-500"
                    >
                        {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <div className="mt-4 flex items-center gap-2 text-zinc-400">
                        <Users className="w-5 h-5" />
                        <span className="font-bold">{eligibleCount} Peserta eligible untuk undian</span>
                    </div>
                </div>

                {/* The Wheel / Big Button */}
                <div className="bg-zinc-900 p-8 rounded-3xl border border-zinc-800 flex flex-col items-center justify-center min-h-[400px] relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-amber-500/10 to-transparent pointer-events-none" />
                    
                    {!winner ? (
                        <div className="text-center z-10 space-y-8">
                            <input 
                                type="text" 
                                placeholder="Nama Hadiah (e.g. Sepeda)"
                                value={prizeName}
                                onChange={(e) => setPrizeName(e.target.value)}
                                className="w-full max-w-md bg-zinc-800 border border-zinc-700 rounded-xl px-6 py-3 text-center text-xl font-bold placeholder:text-zinc-600 focus:border-amber-500 outline-none"
                            />
                            
                            <button 
                                onClick={handleSpin}
                                disabled={isSpinning || eligibleCount === 0}
                                className={`w-48 h-48 rounded-full font-black text-2xl flex flex-col items-center justify-center gap-2 shadow-2xl transition-all transform hover:scale-105 active:scale-95 ${
                                    isSpinning 
                                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                                    : 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-amber-500/30'
                                }`}
                            >
                                {isSpinning ? <RotateCw className="w-12 h-12 animate-spin" /> : <Trophy className="w-12 h-12" />}
                                {isSpinning ? 'SPINNING...' : 'ACAK'}
                            </button>
                            <p className="text-zinc-500 font-medium animate-pulse">
                                {isSpinning ? currentName : "Klik tombol untuk memulai undian"}
                            </p>
                        </div>
                    ) : (
                        <motion.div 
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-center z-10"
                        >
                            <div className="w-32 h-32 bg-amber-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_50px_rgba(245,158,11,0.5)]">
                                <Award className="w-20 h-20 text-white" />
                            </div>
                            <h2 className="text-amber-400 font-black text-3xl mb-2">PEMENANG!</h2>
                            <h3 className="text-4xl font-black text-white mb-1">{winner.name}</h3>
                            <p className="text-zinc-400 font-mono text-xl mb-6">NIK: {winner.nik}</p>
                            <div className="inline-block bg-amber-500/20 text-amber-400 px-4 py-2 rounded-lg font-bold border border-amber-500/30">
                                HADIAH: {prizeName}
                            </div>
                            <button 
                                onClick={() => setWinner(null)}
                                className="mt-8 text-zinc-500 hover:text-white underline"
                            >
                                Undian berikutnya
                            </button>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* RIGHT COL: Log History */}
            <div className="bg-zinc-900 rounded-3xl border border-zinc-800 p-6 h-fit">
                <div className="flex items-center gap-2 mb-6">
                    <History className="w-5 h-5 text-zinc-400" />
                    <h3 className="font-bold text-zinc-300">Riwayat Pemenang</h3>
                </div>
                
                <div className="space-y-4">
                    {loadingLogs ? (
                        <Loader2 className="w-6 h-6 animate-spin text-zinc-500 mx-auto" />
                    ) : winnerLogs.length === 0 ? (
                        <p className="text-zinc-500 text-sm text-center py-4">Belum ada pemenangnya.</p>
                    ) : (
                        winnerLogs.map((log) => (
                            <div key={log.id} className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4 text-green-500" />
                                        <span className="font-bold text-white text-sm">{log.winner_name}</span>
                                    </div>
                                    <span className="text-xs text-zinc-500">{new Date(log.created_at).toLocaleTimeString()}</span>
                                </div>
                                <div className="text-xs text-zinc-400 mb-2">NIK: {log.winner_nik}</div>
                                <div className="inline-block bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                    {log.prize_name}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}