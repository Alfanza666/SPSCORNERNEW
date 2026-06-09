import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { Gift, Users, Trophy, Loader2, Play, Download, Sparkles, Upload, Plus, X, UserPlus, Clock, Image, PartyPopper, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

interface Participant {
  id: string;
  name: string;
  nik: string;
}

interface Prize {
  name: string;
  quantity: number;
}

interface Winner {
  id: string;
  program_id: string;
  winner_name: string;
  winner_nik: string;
  prize_name: string;
  draw_sequence: number;
  drawn_at: string;
}

const playTick = () => {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch (e) {}
};

const playWin = () => {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, ctx.currentTime);
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
    osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.0);
    osc.start();
    osc.stop(ctx.currentTime + 1.0);
  } catch (e) {}
};

const CONFETTI_COLORS = ['#7C3AED', '#F97316', '#10B981', '#3B82F6', '#EC4899', '#F59E0B', '#8B5CF6', '#06B6D4'];

export default function AdminDoorprize() {
  const [activeTab, setActiveTab] = useState<'program' | 'manual' | 'excel'>('program');
  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [allParticipants, setAllParticipants] = useState<Participant[]>([]);
  const [eligibleCount, setEligibleCount] = useState(0);

  const [prizes, setPrizes] = useState<Prize[]>([{ name: '', quantity: 1 }]);
  const [prizeNameInput, setPrizeNameInput] = useState('');
  const [prizeQtyInput, setPrizeQtyInput] = useState(1);
  const [currentPrizeIndex, setCurrentPrizeIndex] = useState(0);

  const [manualName, setManualName] = useState('');
  const [manualNik, setManualNik] = useState('');

  const [winners, setWinners] = useState<Winner[]>([]);
  const [loadingWinners, setLoadingWinners] = useState(false);

  const [isSpinning, setIsSpinning] = useState(false);
  const [currentDisplay, setCurrentDisplay] = useState<Participant | null>(null);
  const [finalWinner, setFinalWinner] = useState<Winner | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const [drawComplete, setDrawComplete] = useState(false);
  const winnerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPrograms();
  }, []);

  useEffect(() => {
    if (activeTab === 'program' && selectedProgramId) {
      fetchParticipants();
      fetchWinners();
    }
  }, [activeTab, selectedProgramId]);

  const fetchPrograms = async () => {
    const { data } = await supabase
      .from('union_programs')
      .select('id, name')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (data) {
      setPrograms(data);
      if (data.length > 0) setSelectedProgramId(data[0].id);
    }
  };

  const fetchParticipants = async () => {
    const { data } = await supabase
      .from('program_coupons')
      .select('id, name, nik, profiles!program_coupons_user_id_fkey(name)')
      .eq('program_id', selectedProgramId)
      .eq('gate_type', 'doorprize')
      .eq('status', 'active');
    if (data) {
      const mapped: Participant[] = data.map((d: any) => ({
        id: d.id,
        name: d.profiles?.name || d.name,
        nik: d.nik,
      }));
      setAllParticipants(mapped);
      setEligibleCount(mapped.length);
    }
  };

  const fetchWinners = async () => {
    setLoadingWinners(true);
    const { data } = await supabase
      .from('program_doorprize_log')
      .select('*')
      .eq('program_id', selectedProgramId)
      .order('draw_sequence', { ascending: true });
    if (data) setWinners(data);
    setLoadingWinners(false);
  };

  const getEligible = useCallback((): Participant[] => {
    const winnerNiks = winners.map(w => w.winner_nik);
    return allParticipants.filter(p => !winnerNiks.includes(p.nik));
  }, [allParticipants, winners]);

  const addPrize = () => {
    if (!prizeNameInput.trim()) {
      toast.error('Masukkan nama hadiah');
      return;
    }
    if (prizeQtyInput < 1) {
      toast.error('Jumlah minimal 1');
      return;
    }
    setPrizes(prev => [...prev, { name: prizeNameInput.trim(), quantity: prizeQtyInput }]);
    setPrizeNameInput('');
    setPrizeQtyInput(1);
  };

  const removePrize = (index: number) => {
    setPrizes(prev => prev.filter((_, i) => i !== index));
  };

  const addManualParticipant = () => {
    if (!manualName.trim()) {
      toast.error('Masukkan nama peserta');
      return;
    }
    if (!manualNik.trim()) {
      toast.error('Masukkan NIK peserta');
      return;
    }
    const exists = allParticipants.some(p => p.nik === manualNik.trim());
    if (exists) {
      toast.error('Peserta dengan NIK ini sudah ada');
      return;
    }
    const newParticipant: Participant = {
      id: `manual_${Date.now()}`,
      name: manualName.trim(),
      nik: manualNik.trim(),
    };
    setAllParticipants(prev => [...prev, newParticipant]);
    setEligibleCount(prev => prev + 1);
    setManualName('');
    setManualNik('');
    toast.success(`${newParticipant.name} ditambahkan`);
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(sheet);
        const mapped: Participant[] = json.map((row, idx) => ({
          id: `excel_${Date.now()}_${idx}`,
          name: row.Name || row.name || row.NAMA || row.Nama || '',
          nik: String(row.NIK || row.Nik || row.nik || row.nik || ''),
        })).filter(p => p.name && p.nik);

        if (mapped.length === 0) {
          toast.error('Tidak ada data valid. Pastikan kolom Name/NAMA dan NIK tersedia.');
          return;
        }

        const existingNiks = new Set(allParticipants.map(p => p.nik));
        const newOnes = mapped.filter(p => !existingNiks.has(p.nik));
        setAllParticipants(prev => [...prev, ...newOnes]);
        setEligibleCount(prev => prev + newOnes.length);
        toast.success(`${newOnes.length} peserta ditambahkan dari Excel`);
      } catch (err) {
        toast.error('Gagal membaca file Excel');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const startSpin = () => {
    if (getEligible().length === 0) {
      toast.error('Tidak ada peserta eligible');
      return;
    }

    if (prizes.length === 0 || prizes.every(p => !p.name)) {
      toast.error('Tambahkan hadiah terlebih dahulu');
      return;
    }

    if (currentPrizeIndex >= prizes.length) {
      setDrawComplete(true);
      toast.success('Semua hadiah sudah diundi!');
      return;
    }

    setFinalWinner(null);
    setShowConfetti(false);
    setIsSpinning(true);

    const eligible = getEligible();
    const duration = 4000;
    const startTime = Date.now();

    const spin = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > duration) {
        finishSpin(eligible);
      } else {
        const rand = eligible[Math.floor(Math.random() * eligible.length)];
        setCurrentDisplay(rand);
        if (elapsed % 100 < 50) playTick();
        const delay = elapsed > duration * 0.7 ? 150 : elapsed > duration * 0.9 ? 300 : 50;
        setTimeout(spin, delay);
      }
    };
    spin();
  };

  const finishSpin = async (eligible: Participant[]) => {
    try {
      const winner = eligible[Math.floor(Math.random() * eligible.length)];
      const currentPrize = prizes[currentPrizeIndex];

      const { data, error } = await supabase
        .from('program_doorprize_log')
        .insert({
          program_id: selectedProgramId || null,
          winner_name: winner.name,
          winner_nik: winner.nik,
          prize_name: currentPrize.name,
          draw_sequence: winners.length + 1,
        })
        .select()
        .single();

      if (error) throw error;

      playWin();

      const winnerData: Winner = {
        id: data?.id || `local_${Date.now()}`,
        program_id: data?.program_id || selectedProgramId,
        winner_name: data?.winner_name || winner.name,
        winner_nik: data?.winner_nik || winner.nik,
        prize_name: data?.prize_name || currentPrize.name,
        draw_sequence: data?.draw_sequence || winners.length + 1,
        drawn_at: data?.drawn_at || new Date().toISOString(),
      };

      setFinalWinner(winnerData);
      setCurrentDisplay(winner);
      setShowConfetti(true);
      setCurrentPrizeIndex(prev => prev + 1);

      const winnerNiks = new Set([...winners.map(w => w.winner_nik), winner.nik]);
      const remaining = allParticipants.filter(p => !winnerNiks.has(p.nik));
      setEligibleCount(remaining.length);

      if (activeTab === 'program') fetchWinners();
      else setWinners(prev => [...prev, winnerData]);

      toast.success(`Selamat! ${winner.name} memenangkan ${currentPrize.name}!`);
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan pemenang');
    } finally {
      setIsSpinning(false);
    }
  };

  const saveWinnerImage = async () => {
    if (!winnerRef.current || !finalWinner) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(winnerRef.current, {
        backgroundColor: '#09090b',
        scale: 2,
      });
      const link = document.createElement('a');
      link.download = `pemenang_${finalWinner.winner_name.replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('Gambar pemenang disimpan!');
    } catch {
      toast.error('Gagal menyimpan gambar');
    }
  };

  const exportWinners = () => {
    if (winners.length === 0) {
      toast.error('Belum ada pemenang');
      return;
    }
    const data = winners.map((w, i) => ({
      'No': i + 1,
      'Hadiah': w.prize_name,
      'Nama Pemenang': w.winner_name,
      'NIK': w.winner_nik,
      'Waktu Undian': format(new Date(w.drawn_at), 'dd MMM yyyy HH:mm:ss'),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pemenang');
    XLSX.writeFile(wb, `Doorprize_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
  };

  const resetDraw = () => {
    setFinalWinner(null);
    setCurrentDisplay(null);
    setShowConfetti(false);
    setCurrentPrizeIndex(0);
    setDrawComplete(false);
    setPrizes([{ name: '', quantity: 1 }]);
  };

  const currentPrize = prizes[currentPrizeIndex];
  const remainingPrizes = prizes.slice(currentPrizeIndex);
  const totalDraws = prizes.reduce((sum, p) => sum + p.quantity, 0);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 dark:text-white">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black flex items-center gap-3">
            <Gift className="w-8 h-8 text-purple-500" />
            Undian Doorprize
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
            Acak pemenang doorprize dari 3 sumber peserta
          </p>
        </div>
        {winners.length > 0 && (
          <button onClick={exportWinners}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 font-bold rounded-xl transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Excel
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <h3 className="text-sm font-black text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-500" />
              Sumber Peserta
            </h3>

            <div className="flex gap-1 mb-4 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1">
              {(['program', 'manual', 'excel'] as const).map(tab => (
                <button key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    activeTab === tab
                      ? 'bg-white dark:bg-zinc-700 text-purple-600 dark:text-purple-400 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  {tab === 'program' ? 'Program' : tab === 'manual' ? 'Manual' : 'Excel'}
                </button>
              ))}
            </div>

            {activeTab === 'program' && (
              <div className="space-y-4">
                <select
                  value={selectedProgramId}
                  onChange={e => setSelectedProgramId(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-purple-500/20 outline-none"
                >
                  <option value="">-- Pilih Program --</option>
                  {programs.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}

            {activeTab === 'manual' && (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Nama peserta"
                  value={manualName}
                  onChange={e => setManualName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addManualParticipant()}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-purple-500/20 outline-none"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="NIK"
                    value={manualNik}
                    onChange={e => setManualNik(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addManualParticipant()}
                    className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-purple-500/20 outline-none"
                  />
                  <button onClick={addManualParticipant}
                    className="px-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-all active:scale-95"
                  >
                    <UserPlus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'excel' && (
              <div className="space-y-3">
                <label className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-2xl cursor-pointer hover:border-purple-500 dark:hover:border-purple-400 transition-colors">
                  <Upload className="w-8 h-8 text-zinc-400" />
                  <span className="text-sm font-bold text-zinc-500">Upload file .xlsx</span>
                  <span className="text-xs text-zinc-400">Kolom: Name/NAMA dan NIK</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleExcelUpload}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            <div className="mt-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/30 rounded-xl p-4 flex items-center gap-3">
              <Users className="w-8 h-8 text-purple-500 shrink-0" />
              <div>
                <div className="text-sm text-purple-700 dark:text-purple-400 font-bold">Total Peserta</div>
                <div className="text-xl font-black text-purple-800 dark:text-purple-300">
                  {eligibleCount} <span className="text-sm font-medium text-purple-600/70">Eligible</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <h3 className="text-sm font-black text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-purple-500" />
              Daftar Hadiah
            </h3>

            {prizes.length > 0 && (
              <div className="space-y-2 mb-4">
                {prizes.map((prize, idx) => (
                  <div key={idx}
                    className={`flex items-center justify-between p-3 rounded-xl border ${
                      idx === currentPrizeIndex && !finalWinner && !isSpinning
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                        : idx < currentPrizeIndex
                          ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 opacity-60'
                          : 'border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                        idx < currentPrizeIndex
                          ? 'bg-green-500 text-white'
                          : idx === currentPrizeIndex && !finalWinner && !isSpinning
                            ? 'bg-purple-600 text-white'
                            : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-500'
                      }`}>
                        {idx < currentPrizeIndex ? '✓' : idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate">{prize.name}</p>
                        <p className="text-xs text-zinc-400">x{prize.quantity}</p>
                      </div>
                    </div>
                    {prize.name && (
                      <button onClick={() => removePrize(idx)}
                        className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nama hadiah"
                value={prizeNameInput}
                onChange={e => setPrizeNameInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addPrize()}
                className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-purple-500/20 outline-none"
              />
              <input
                type="number"
                min={1}
                value={prizeQtyInput}
                onChange={e => setPrizeQtyInput(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-2 py-2.5 text-sm font-bold text-center focus:ring-2 focus:ring-purple-500/20 outline-none"
              />
              <button onClick={addPrize}
                className="px-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-all active:scale-95"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          <button
            onClick={startSpin}
            disabled={isSpinning || eligibleCount === 0 || prizes.every(p => !p.name) || currentPrizeIndex >= prizes.length}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black rounded-xl shadow-lg shadow-purple-500/30 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 text-lg"
          >
            {isSpinning ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Mengacak...</>
            ) : drawComplete ? (
              <><RotateCcw className="w-5 h-5" /> Mulai Ulang</>
            ) : currentPrizeIndex >= prizes.length ? (
              'Selesai'
            ) : (
              <><Play className="w-5 h-5" /> Undi Hadiah: {currentPrize?.name || '-'}</>
            )}
          </button>

          {drawComplete && (
            <button onClick={resetDraw}
              className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-bold rounded-xl transition-all"
            >
              Reset Undian
            </button>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div ref={winnerRef}
            className="relative bg-white dark:bg-zinc-950 rounded-[2.5rem] p-8 md:p-12 border-4 border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col items-center justify-center min-h-[400px] shadow-2xl"
          >
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/20 blur-[100px] rounded-full" />
            </div>

            {showConfetti && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {Array.from({ length: 40 }).map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ x: '50%', y: '50%', scale: 0, opacity: 1 }}
                    animate={{
                      x: `${50 + (Math.random() - 0.5) * 100}%`,
                      y: `${50 + (Math.random() - 0.5) * 100}%`,
                      scale: [0, 1, 0.5],
                      opacity: [1, 1, 0],
                      rotate: Math.random() * 720,
                    }}
                    transition={{ duration: 1.5 + Math.random() * 1, ease: 'easeOut' }}
                    className="absolute w-3 h-3 rounded-sm"
                    style={{ backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length] }}
                  />
                ))}
              </div>
            )}

            {!currentDisplay && !finalWinner && !isSpinning && (
              <div className="text-center z-10">
                <Gift className="w-24 h-24 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
                <h2 className="text-2xl font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">Siap Diundi</h2>
                <p className="text-zinc-400 dark:text-zinc-500">Atur peserta & hadiah, lalu tekan tombol undi</p>
              </div>
            )}

            <AnimatePresence mode="wait">
              {(isSpinning || (currentDisplay && !finalWinner)) && !showConfetti && (
                <motion.div
                  key={currentDisplay?.nik || 'spin'}
                  initial={{ opacity: 0, y: 50, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -50, scale: 0.9 }}
                  transition={{ duration: 0.1 }}
                  className="text-center z-10 w-full"
                >
                  <h2 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-zinc-900 dark:from-white to-zinc-500 dark:to-zinc-400 mb-4 truncate px-4">
                    {currentDisplay?.name || 'Mengacak...'}
                  </h2>
                  <div className="inline-block px-6 py-2 bg-purple-500/20 border border-purple-500/30 rounded-full">
                    <span className="font-mono text-xl md:text-2xl font-bold text-purple-600 dark:text-purple-400 tracking-widest">
                      {currentDisplay?.nik || '-------'}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {finalWinner && !isSpinning && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', duration: 0.6 }}
                className="text-center z-10 w-full"
              >
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-purple-600 to-pink-500 rounded-full text-white text-sm font-bold uppercase tracking-widest mb-4 shadow-lg">
                  <PartyPopper className="w-4 h-4" />
                  Pemenang
                </div>
                <h2 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 mb-2 drop-shadow-lg">
                  {finalWinner.winner_name}
                </h2>
                <div className="inline-block px-6 py-2 bg-black/10 dark:bg-white/10 border border-zinc-300 dark:border-zinc-600 rounded-full mb-4">
                  <span className="font-mono text-xl font-bold text-zinc-600 dark:text-zinc-300 tracking-widest">
                    {finalWinner.winner_nik}
                  </span>
                </div>
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-xl inline-block shadow-[0_0_30px_rgba(147,51,234,0.5)]">
                  <span className="font-bold">Mendapatkan: </span>
                  <span className="font-black text-lg ml-1">{finalWinner.prize_name}</span>
                </div>
              </motion.div>
            )}

            {finalWinner && !isSpinning && (
              <div className="mt-6 flex items-center gap-3 z-10">
                <button onClick={saveWinnerImage}
                  className="flex items-center gap-2 px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-bold rounded-xl transition-all text-sm"
                >
                  <Image className="w-4 h-4" />
                  Simpan Gambar
                </button>
                <button onClick={() => { setFinalWinner(null); setShowConfetti(false); setCurrentDisplay(null); }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-all text-sm"
                >
                  <Play className="w-4 h-4" />
                  Undian Berikutnya
                </button>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <h3 className="text-sm font-black text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Riwayat Pemenang
              {winners.length > 0 && (
                <span className="text-purple-600 dark:text-purple-400 font-black text-xs ml-2">
                  ({winners.length})
                </span>
              )}
            </h3>

            {loadingWinners ? (
              <Loader2 className="w-6 h-6 animate-spin text-purple-500 mx-auto" />
            ) : winners.length === 0 ? (
              <p className="text-zinc-400 dark:text-zinc-500 text-center py-6 text-sm font-medium">
                Belum ada pemenang
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                {winners.map((w, i) => (
                  <div key={w.id || i}
                    className="flex items-center gap-3 p-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700/50 rounded-2xl"
                  >
                    <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-black flex items-center justify-center shrink-0 shadow-sm">
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-zinc-900 dark:text-white truncate">{w.winner_name}</p>
                      <p className="text-xs text-zinc-500 truncate">
                        {w.winner_nik} &middot; {w.prize_name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
