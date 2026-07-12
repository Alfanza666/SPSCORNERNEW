import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { Gift, Users, Trophy, Loader2, Play, Download, Upload, Plus, X, UserPlus, Clock, Image, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
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
  program_id: string | null;
  winner_name: string;
  winner_nik: string;
  prize_name: string;
  drawn_at: string;
}

const SEGMENT_COLORS = [
  '#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6',
  '#1abc9c','#e67e22','#2980b9','#27ae60','#d35400',
  '#8e44ad','#16a085','#c0392b','#2c3e50','#f1c40f',
  '#7f8c8d','#34495e','#e91e63','#00bcd4','#ff5722',
];

const CONFETTI_COLORS = ['#e74c3c','#f39c12','#2ecc71','#3498db','#9b59b6','#1abc9c','#e91e63','#ff9800'];

let sharedAudioCtx: AudioContext | null = null;

const getAudioCtx = () => {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AC();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume();
    }
    return sharedAudioCtx;
  } catch { return null; }
};

const playTick = () => {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.03);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.04);
  } catch {}
};

const playWin = () => {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
      gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.6);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.6);
    });
  } catch {}
};

const SPIN_DURATION = 5500;

export default function AdminDoorprize() {
  const [activeTab, setActiveTab] = useState<'program' | 'manual' | 'excel'>('program');
  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [allParticipants, setAllParticipants] = useState<Participant[]>([]);
  const [eligibleCount, setEligibleCount] = useState(0);

  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [prizeNameInput, setPrizeNameInput] = useState('');
  const [prizeQtyInput, setPrizeQtyInput] = useState(1);
  const [currentPrizeIndex, setCurrentPrizeIndex] = useState(0);

  const [manualName, setManualName] = useState('');
  const [manualNik, setManualNik] = useState('');

  const [winners, setWinners] = useState<Winner[]>([]);
  const [loadingWinners, setLoadingWinners] = useState(false);

  const [isSpinning, setIsSpinning] = useState(false);
  const [showWinner, setShowWinner] = useState(false);
  const [latestWinner, setLatestWinner] = useState<Winner | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [drawComplete, setDrawComplete] = useState(false);

  const [wheelRotation, setWheelRotation] = useState(0);
  const wheelRef = useRef<HTMLDivElement>(null);
  const winnerRef = useRef<HTMLDivElement>(null);
  const tickRef = useRef<number | null>(null);

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
    try {
      // V2: Use the doorprize-eligible endpoint
      const response = await fetch(`/api/admin/programs/${selectedProgramId}/doorprize-eligible`);
      const result = await response.json();
      
      if (result.success && result.participants) {
        const mapped: Participant[] = result.participants.map((p: any) => ({
          id: p.id, name: p.attendee_name || p.name || 'Karyawan', nik: p.nik,
        }));
        setAllParticipants(mapped);
        setEligibleCount(mapped.length);
      } else {
        // Fallback to legacy query if V2 not available
        const { data } = await supabase
          .from('program_coupons')
          .select('id, name, nik, profiles!program_coupons_user_id_fkey(name)')
          .eq('program_id', selectedProgramId)
          .eq('gate_type', 'doorprize')
          .eq('status', 'active');
        if (data) {
          const mapped: Participant[] = data.map((d: any) => ({
            id: d.id, name: d.profiles?.name || d.name, nik: d.nik,
          }));
          setAllParticipants(mapped);
          setEligibleCount(mapped.length);
        }
      }
    } catch (e) {
      console.error("Failed to fetch V2 participants, falling back to legacy:", e);
      // Fallback to legacy query
      const { data } = await supabase
        .from('program_coupons')
        .select('id, name, nik, profiles!program_coupons_user_id_fkey(name)')
        .eq('program_id', selectedProgramId)
        .eq('gate_type', 'doorprize')
        .eq('status', 'active');
      if (data) {
        const mapped: Participant[] = data.map((d: any) => ({
          id: d.id, name: d.profiles?.name || d.name, nik: d.nik,
        }));
        setAllParticipants(mapped);
        setEligibleCount(mapped.length);
      }
    }
  };

  const fetchWinners = async () => {
    setLoadingWinners(true);
    const { data } = await supabase
      .from('program_doorprize_log')
      .select('*')
      .eq('program_id', selectedProgramId)
      .order('drawn_at', { ascending: true });
    if (data) setWinners(data);
    setLoadingWinners(false);
  };

  const addPrize = () => {
    if (!prizeNameInput.trim()) { toast.error('Masukkan nama hadiah'); return; }
    if (prizeQtyInput < 1) { toast.error('Jumlah minimal 1'); return; }
    setPrizes(prev => [...prev, { name: prizeNameInput.trim(), quantity: prizeQtyInput }]);
    setPrizeNameInput('');
    setPrizeQtyInput(1);
  };

  const removePrize = (index: number) => {
    setPrizes(prev => prev.filter((_, i) => i !== index));
  };

  const clearPrizes = () => {
    setPrizes([]);
    setPrizeNameInput('');
    setPrizeQtyInput(1);
  };

  const addManualParticipant = () => {
    if (!manualName.trim()) { toast.error('Masukkan nama'); return; }
    if (!manualNik.trim()) { toast.error('Masukkan NIK'); return; }
    if (allParticipants.some(p => p.nik === manualNik.trim())) { toast.error('NIK sudah ada'); return; }
    const newP: Participant = { id: `manual_${Date.now()}`, name: manualName.trim(), nik: manualNik.trim() };
    setAllParticipants(prev => [...prev, newP]);
    setEligibleCount(prev => prev + 1);
    setManualName('');
    setManualNik('');
  };

  const removeParticipant = (nik: string) => {
    setAllParticipants(prev => prev.filter(p => p.nik !== nik));
    setEligibleCount(prev => Math.max(0, prev - 1));
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const json: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        const mapped = json.map((row, idx) => ({
          id: `excel_${Date.now()}_${idx}`,
          name: row.Name || row.name || row.NAMA || row.Nama || '',
          nik: String(row.NIK || row.Nik || row.nik || ''),
        })).filter(p => p.name && p.nik);
        if (mapped.length === 0) { toast.error('Data tidak valid. Kolom: Name/NAMA + NIK'); return; }
        const existingNiks = new Set(allParticipants.map(p => p.nik));
        const newOnes = mapped.filter(p => !existingNiks.has(p.nik));
        setAllParticipants(prev => [...prev, ...newOnes]);
        setEligibleCount(prev => prev + newOnes.length);
        toast.success(`${newOnes.length} peserta ditambahkan`);
      } catch { toast.error('Gagal membaca Excel'); }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const getEligible = (): Participant[] => {
    const winnerNiks = new Set(winners.map(w => w.winner_nik));
    return allParticipants.filter(p => !winnerNiks.has(p.nik));
  };

  const spinWheel = () => {
    const eligible = getEligible();
    if (eligible.length === 0) { toast.error('Tidak ada peserta eligible'); return; }
    if (prizes.length === 0) { toast.error('Tambahkan hadiah terlebih dahulu'); return; }
    if (currentPrizeIndex >= prizes.length) { setDrawComplete(true); return; }

    setShowWinner(false);
    setLatestWinner(null);
    setShowConfetti(false);
    setIsSpinning(true);

    const winnerIdx = Math.floor(Math.random() * eligible.length);
    const winner = eligible[winnerIdx];
    const segAngle = 360 / eligible.length;

    const targetAngle = winnerIdx * segAngle + segAngle / 2;
    const fullSpins = 360 * (5 + Math.floor(Math.random() * 4));
    const offset = (360 - targetAngle + 360) % 360;
    const totalAdd = fullSpins + offset;
    const newRotation = wheelRotation + totalAdd;

    setWheelRotation(newRotation);

    const tickStart = Date.now();
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = window.setInterval(() => {
      const elapsed = Date.now() - tickStart;
      if (elapsed < SPIN_DURATION - 800) {
        playTick();
      } else {
        if (tickRef.current) clearInterval(tickRef.current);
        tickRef.current = null;
      }
    }, 70);

    setTimeout(() => {
      setIsSpinning(false);
      completeSpin(winner);
    }, SPIN_DURATION + 150);
  };

  const completeSpin = async (winner: Participant) => {
    const currentPrize = prizes[currentPrizeIndex];

    try {
      const { data, error } = await supabase
        .from('program_doorprize_log')
        .insert({
          program_id: selectedProgramId || null,
          winner_name: winner.name,
          winner_nik: winner.nik,
          prize_name: currentPrize.name,
        })
        .select()
        .single();

      if (error) throw error;

      playWin();

      const w: Winner = {
        id: data?.id || `local_${Date.now()}`,
        program_id: data?.program_id || selectedProgramId,
        winner_name: data?.winner_name || winner.name,
        winner_nik: data?.winner_nik || winner.nik,
        prize_name: data?.prize_name || currentPrize.name,
        drawn_at: data?.drawn_at || new Date().toISOString(),
      };

      setLatestWinner(w);
      setShowWinner(true);
      setShowConfetti(true);
      setCurrentPrizeIndex(prev => prev + 1);

      const winnerNiks = new Set([...winners.map(x => x.winner_nik), w.winner_nik]);
      setEligibleCount(allParticipants.filter(p => !winnerNiks.has(p.nik)).length);

      if (activeTab === 'program') fetchWinners();
      else setWinners(prev => [...prev, w]);

      toast.success(`Selamat! ${w.winner_name} menang ${w.prize_name}!`);

      try { if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]); } catch {}
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan pemenang');
    }
  };

  const saveWinnerImage = async () => {
    if (!winnerRef.current || !latestWinner) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(winnerRef.current, { backgroundColor: '#0f0f1a', scale: 2 });
      const link = document.createElement('a');
      link.download = `pemenang_${latestWinner.winner_name.replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('Gambar disimpan!');
    } catch { toast.error('Gagal menyimpan gambar'); }
  };

  const exportWinners = () => {
    if (winners.length === 0) { toast.error('Belum ada pemenang'); return; }
    const data = winners.map((w, i) => ({
      'No': i + 1, 'Hadiah': w.prize_name, 'Nama': w.winner_name, 'NIK': w.winner_nik,
      'Waktu': format(new Date(w.drawn_at), 'dd MMM yyyy HH:mm:ss'),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pemenang');
    XLSX.writeFile(wb, `Doorprize_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
  };

  const resetAll = () => {
    setShowWinner(false);
    setLatestWinner(null);
    setShowConfetti(false);
    setCurrentPrizeIndex(0);
    setDrawComplete(false);
    setWheelRotation(0);
    setPrizes([]);
  };

  const currentPrize = currentPrizeIndex < prizes.length ? prizes[currentPrizeIndex] : null;
  const eligible = getEligible();
  const segAngleDeg = eligible.length > 0 ? 360 / eligible.length : 0;
  const showNamesOnWheel = eligible.length <= 36;
  const fontSize = Math.max(8, Math.min(14, Math.floor(240 / Math.max(eligible.length, 1))));

  const renderWheelSVG = () => {
    if (eligible.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-3 p-8">
          <Gift className="w-16 h-16 text-zinc-400/50" />
          <p className="font-bold text-lg">Belum ada peserta</p>
          <p className="text-sm">Tambah peserta via panel samping</p>
        </div>
      );
    }

    const R = 220;
    const segs = eligible.map((p, i) => {
      const startDeg = i * segAngleDeg;
      const endDeg = (i + 1) * segAngleDeg;
      const sRad = ((startDeg - 90) * Math.PI) / 180;
      const eRad = ((endDeg - 90) * Math.PI) / 180;
      const x1 = R * Math.cos(sRad), y1 = R * Math.sin(sRad);
      const x2 = R * Math.cos(eRad), y2 = R * Math.sin(eRad);
      const large = segAngleDeg > 180 ? 1 : 0;
      const d = `M 0 0 L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`;
      const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
      const midDeg = startDeg + segAngleDeg / 2;

      let label = p.name;
      if (segAngleDeg < 25 && label.length > 4) label = label.slice(0, 3) + '..';
      else if (segAngleDeg < 40 && label.length > 8) label = label.slice(0, 6) + '..';

      return { d, color, midDeg, label, nik: p.nik };
    });

    const textR = R * 0.6;

    return (
      <svg viewBox="-240 -240 480 480" className="w-full h-full" style={{ filter: 'drop-shadow(0 0 20px rgba(0,0,0,0.3))' }}>
        <circle cx="0" cy="0" r={R} fill="none" stroke="#333" strokeWidth="3" />
        <circle cx="0" cy="0" r={R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        {segs.map(s => (
          <g key={s.nik}>
            <path d={s.d} fill={s.color} stroke="#1a1a2e" strokeWidth="2" />
          </g>
        ))}
        {showNamesOnWheel && segs.map(s => {
          const mRad = ((s.midDeg - 90) * Math.PI) / 180;
          const tx = textR * Math.cos(mRad);
          const ty = textR * Math.sin(mRad);
          return (
            <text key={`t-${s.nik}`}
              x={tx} y={ty}
              transform={`rotate(${s.midDeg}, ${tx}, ${ty})`}
              textAnchor="middle" dominantBaseline="middle"
              fill="white" fontSize={fontSize} fontWeight="bold"
              style={{ textShadow: '0 1px 3px rgba(0,0,0,0.7)', pointerEvents: 'none', fontFamily: 'system-ui' }}
            >
              {s.label}
            </text>
          );
        })}
        {!showNamesOnWheel && (
          <text x="0" y="-8" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold" style={{ textShadow: '0 2px 6px rgba(0,0,0,0.8)' }}>
            {eligible.length}
          </text>
        )}
        {!showNamesOnWheel && (
          <text x="0" y="12" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="11" fontWeight="bold">
            peserta
          </text>
        )}
        <circle cx="0" cy="0" r="28" fill="#1a1a2e" stroke="#444" strokeWidth="2" />
        <circle cx="0" cy="0" r="8" fill="#7C3AED" />
        <polygon points="-14,-215 14,-215 0,-245" fill="#FFD700" stroke="#333" strokeWidth="2" />
      </svg>
    );
  };

  const winnerName = latestWinner?.winner_name || '';
  const currentPrizeLabel = currentPrize?.name || '-';

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 dark:text-white select-none">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black flex items-center gap-3">
            <Gift className="w-8 h-8 text-purple-500" />
            Undian Doorprize
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
            Roda undian interaktif — acak pemenang dengan adil
          </p>
        </div>
        {winners.length > 0 && (
          <button onClick={exportWinners}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 font-bold rounded-xl transition-colors"
          >
            <Download className="w-4 h-4" /> Export Excel
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT: Controls */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-5">
          {/* Participant Source */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-purple-500" /> Sumber Peserta
            </h3>
            <div className="flex gap-1 mb-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1">
              {(['program', 'manual', 'excel'] as const).map(tab => (
                <button key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
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
              <select value={selectedProgramId} onChange={e => setSelectedProgramId(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-purple-500/20 outline-none"
              >
                <option value="">-- Pilih Program --</option>
                {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            {activeTab === 'manual' && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input type="text" placeholder="Nama" value={manualName}
                    onChange={e => setManualName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addManualParticipant()}
                    className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-purple-500/20 outline-none" />
                  <input type="text" placeholder="NIK" value={manualNik}
                    onChange={e => setManualNik(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addManualParticipant()}
                    className="w-28 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-purple-500/20 outline-none" />
                  <button onClick={addManualParticipant}
                    className="px-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-all active:scale-95 shrink-0">
                    <UserPlus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
            {activeTab === 'excel' && (
              <label className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-2xl cursor-pointer hover:border-purple-500 dark:hover:border-purple-400 transition-colors">
                <Upload className="w-6 h-6 text-zinc-400" />
                <span className="text-xs font-bold text-zinc-500">Upload .xlsx</span>
                <input type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} className="hidden" />
              </label>
            )}
            <div className="mt-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/30 rounded-xl p-3 flex items-center gap-3">
              <Users className="w-6 h-6 text-purple-500 shrink-0" />
              <div>
                <div className="text-xs text-purple-700 dark:text-purple-400 font-bold">Total Peserta</div>
                <div className="text-lg font-black text-purple-800 dark:text-purple-300">
                  {eligibleCount} <span className="text-xs font-medium text-purple-600/70">Eligible</span>
                </div>
              </div>
            </div>
          </div>

          {/* Prize List */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-black text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <Trophy className="w-3.5 h-3.5 text-purple-500" /> Hadiah
              </h3>
              {prizes.length > 0 && (
                <button onClick={clearPrizes} className="text-[10px] font-bold text-red-400 hover:text-red-500 flex items-center gap-1">
                  <Trash2 className="w-3 h-3" /> Hapus semua
                </button>
              )}
            </div>

            {prizes.length > 0 && (
              <div className="space-y-1.5 mb-3 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                {prizes.map((prize, idx) => (
                  <div key={idx}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl border text-sm ${
                      idx === currentPrizeIndex && !latestWinner && !isSpinning
                        ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20 ring-1 ring-purple-400'
                        : idx < currentPrizeIndex
                          ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 opacity-60'
                          : 'border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${
                        idx < currentPrizeIndex ? 'bg-green-500 text-white'
                          : idx === currentPrizeIndex && !latestWinner && !isSpinning
                            ? 'bg-purple-600 text-white'
                            : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-500'
                      }`}>
                        {idx < currentPrizeIndex ? '✓' : idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate">{prize.name}</p>
                        <p className="text-[10px] text-zinc-400">x{prize.quantity}</p>
                      </div>
                    </div>
                    <button onClick={() => removePrize(idx)}
                      className="p-1 text-zinc-400 hover:text-red-500 transition-colors ml-1 shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-1.5">
              <input type="text" placeholder="Nama hadiah" value={prizeNameInput}
                onChange={e => setPrizeNameInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addPrize()}
                className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-purple-500/20 outline-none" />
              <input type="number" min={1} value={prizeQtyInput}
                onChange={e => setPrizeQtyInput(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-14 text-center bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-1 py-2 text-xs font-bold focus:ring-2 focus:ring-purple-500/20 outline-none" />
              <button onClick={addPrize}
                className="px-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-all active:scale-95 shrink-0">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Participant List */}
          {eligible.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-4 border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">
                  Peserta ({eligible.length})
                </h4>
                {activeTab !== 'program' && (
                  <button onClick={() => { setAllParticipants([]); setEligibleCount(0); }}
                    className="text-[10px] font-bold text-red-400 hover:text-red-500">
                    Kosongkan
                  </button>
                )}
              </div>
              <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-0.5">
                {eligible.map((p, i) => (
                  <div key={p.nik} className="flex items-center gap-2 py-1 text-xs group">
                    <span className="w-4 h-4 rounded flex items-center justify-center text-[8px] font-black shrink-0"
                      style={{ backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length], color: 'white' }}>
                      {i + 1}
                    </span>
                    <span className="font-medium truncate">{p.name}</span>
                    <span className="text-zinc-400 shrink-0 text-[10px]">{p.nik}</span>
                    {activeTab !== 'program' && (
                      <button onClick={() => removeParticipant(p.nik)}
                        className="ml-auto opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 transition-opacity">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SPIN BUTTON */}
          <button
            onClick={spinWheel}
            disabled={isSpinning || eligibleCount === 0 || prizes.length === 0 || currentPrizeIndex >= prizes.length}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black rounded-2xl shadow-lg shadow-purple-500/30 transition-all active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center justify-center gap-2 text-lg relative overflow-hidden"
          >
            {isSpinning ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Memutar...</>
            ) : drawComplete ? (
              <><RotateCcw className="w-5 h-5" /> Mulai Ulang</>
            ) : (
              <><Play className="w-5 h-5" /> Putar: {currentPrizeLabel}</>
            )}
          </button>
          {drawComplete && (
            <button onClick={resetAll} className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-bold rounded-xl transition-all text-sm">
              Reset Semua
            </button>
          )}
        </div>

        {/* RIGHT: Wheel + Winner */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          <div className="relative bg-white dark:bg-zinc-950 rounded-[2.5rem] p-3 md:p-6 border-4 border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-2xl">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/5 blur-[150px] rounded-full" />
            </div>

            <div className={`relative w-full max-w-[550px] mx-auto aspect-square transition-all duration-500 ${showWinner ? 'opacity-20 scale-90 blur-sm' : 'opacity-100 scale-100'}`}>
              <div ref={wheelRef}
                style={{
                  transform: `rotate(${wheelRotation}deg)`,
                  transition: isSpinning ? `transform ${SPIN_DURATION}ms cubic-bezier(0.13, 0.75, 0.08, 0.99)` : 'none',
                  willChange: 'transform',
                }}
                className="w-full h-full"
              >
                {renderWheelSVG()}
              </div>
            </div>

            <AnimatePresence>
              {showWinner && latestWinner && (
                <motion.div
                  ref={winnerRef}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                  className="absolute inset-0 flex items-center justify-center z-20 p-4 md:p-8"
                  style={{ background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.3) 0%, transparent 70%)' }}
                >
                  <div className="text-center w-full max-w-lg">
                    {showConfetti && (
                      <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
                        {Array.from({ length: 60 }).map((_, i) => (
                          <motion.div
                            key={i}
                            initial={{ x: '50vw', y: '50vh', scale: 0, opacity: 1 }}
                            animate={{
                              x: `${Math.random() * 100}vw`,
                              y: `${Math.random() * 100}vh`,
                              scale: [0, 1.5, 0.8],
                              opacity: [1, 1, 0],
                              rotate: Math.random() * 1080,
                            }}
                            transition={{ duration: 2.5 + Math.random() * 2, ease: 'easeOut' }}
                            className="absolute w-3 h-3"
                            style={{
                              backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                              borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                            }}
                          />
                        ))}
                      </div>
                    )}

                    <motion.div
                      initial={{ y: 40, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2, type: 'spring' }}
                    >
                      <div className="inline-flex items-center gap-2 px-5 py-1.5 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full text-white text-sm font-black uppercase tracking-[0.15em] mb-4 shadow-lg shadow-orange-500/30">
                        <Sparkles className="w-4 h-4" />
                        Pemenang
                      </div>

                      <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-purple-300 via-pink-300 to-yellow-200 mb-2 drop-shadow-lg leading-tight">
                        {latestWinner.winner_name}
                      </h2>

                      <div className="inline-block px-4 py-1.5 bg-black/30 backdrop-blur-sm border border-white/20 rounded-full mb-4">
                        <span className="font-mono text-base font-bold text-white/90 tracking-widest">
                          {latestWinner.winner_nik}
                        </span>
                      </div>

                      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-5 py-3 rounded-xl inline-flex items-center gap-2.5 shadow-[0_0_30px_rgba(147,51,234,0.5)] mx-auto">
                        <Trophy className="w-5 h-5" />
                        <span className="font-bold text-sm">Mendapatkan:</span>
                        <span className="font-black text-lg">{latestWinner.prize_name}</span>
                      </div>

                      <div className="mt-5 flex items-center justify-center gap-3 flex-wrap">
                        <button onClick={saveWinnerImage}
                          className="flex items-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-bold rounded-xl transition-all text-sm"
                        >
                          <Image className="w-4 h-4" /> Simpan Gambar
                        </button>
                        <button onClick={() => { setShowWinner(false); setLatestWinner(null); setShowConfetti(false); }}
                          className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white font-bold rounded-xl transition-all text-sm shadow-lg"
                        >
                          <Play className="w-4 h-4" /> Undian Berikutnya
                        </button>
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Winners History */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" /> Riwayat Pemenang
              {winners.length > 0 && (
                <span className="text-purple-600 dark:text-purple-400 font-black text-[10px]">({winners.length})</span>
              )}
            </h3>
            {loadingWinners ? (
              <Loader2 className="w-5 h-5 animate-spin text-purple-500 mx-auto" />
            ) : winners.length === 0 ? (
              <p className="text-zinc-400 dark:text-zinc-500 text-center py-4 text-sm">Belum ada pemenang</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                {winners.map((w, i) => (
                  <div key={w.id || i}
                    className="flex items-center gap-2.5 p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700/50 rounded-xl"
                  >
                    <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-black flex items-center justify-center shrink-0 text-xs">
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{w.winner_name}</p>
                      <p className="text-[10px] text-zinc-500 truncate">{w.winner_nik} &middot; {w.prize_name}</p>
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
