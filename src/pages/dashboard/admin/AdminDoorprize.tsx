import React, { useState, useEffect, useRef } from 'react';
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
  program_id: string | null;
  winner_name: string;
  winner_nik: string;
  prize_name: string;
  drawn_at: string;
}

const SEGMENT_COLORS = [
  '#7C3AED', '#3B82F6', '#10B981', '#F59E0B', '#EC4899',
  '#F97316', '#06B6D4', '#8B5CF6', '#EF4444', '#14B8A6',
  '#6366F1', '#84CC16', '#D946EF', '#0EA5E9', '#22C55E',
  '#EAB308', '#A855F7', '#38BDF8', '#FB923C', '#2DD4BF',
];

const CONFETTI_COLORS = ['#7C3AED', '#F97316', '#10B981', '#3B82F6', '#EC4899', '#F59E0B', '#8B5CF6', '#06B6D4'];

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
    osc.stop(ctx.currentTime + 0.07);
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
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12);
    osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.24);
    osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.36);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2);
    osc.start();
    osc.stop(ctx.currentTime + 1.2);
  } catch (e) {}
};

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
  const [showWinner, setShowWinner] = useState(false);
  const [latestWinner, setLatestWinner] = useState<Winner | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [drawComplete, setDrawComplete] = useState(false);

  const [wheelRotation, setWheelRotation] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const wheelRef = useRef<HTMLDivElement>(null);
  const winnerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const tickIntervalRef = useRef<number | null>(null);
  const pendingWinner = useRef<Participant | null>(null);

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

  const addManualParticipant = () => {
    if (!manualName.trim()) { toast.error('Masukkan nama peserta'); return; }
    if (!manualNik.trim()) { toast.error('Masukkan NIK peserta'); return; }
    if (allParticipants.some(p => p.nik === manualNik.trim())) { toast.error('NIK sudah ada'); return; }
    const newP: Participant = { id: `manual_${Date.now()}`, name: manualName.trim(), nik: manualNik.trim() };
    setAllParticipants(prev => [...prev, newP]);
    setEligibleCount(prev => prev + 1);
    setManualName('');
    setManualNik('');
    toast.success(`${newP.name} ditambahkan`);
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
        if (mapped.length === 0) { toast.error('Tidak ada data valid. Kolom: Name/NAMA + NIK'); return; }
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
    if (prizes.every(p => !p.name)) { toast.error('Tambahkan hadiah terlebih dahulu'); return; }
    if (currentPrizeIndex >= prizes.length) { setDrawComplete(true); toast.success('Semua hadiah sudah diundi!'); return; }

    setShowWinner(false);
    setLatestWinner(null);
    setShowConfetti(false);
    setIsSpinning(true);
    setIsTransitioning(true);

    const winnerIdx = Math.floor(Math.random() * eligible.length);
    const winner = eligible[winnerIdx];
    pendingWinner.current = winner;

    const segAngle = 360 / eligible.length;
    const targetAngle = winnerIdx * segAngle + segAngle / 2;
    const fullSpins = 360 * (5 + Math.floor(Math.random() * 3));
    const totalAdd = fullSpins + (360 - targetAngle);

    setWheelRotation(prev => prev + totalAdd);

    const spinDuration = 5000 + Math.random() * 1000;
    if (wheelRef.current) {
      wheelRef.current.style.transition = `transform ${spinDuration}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)`;
    }

    let startTime = Date.now();
    const tickInterval = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      if (elapsed < spinDuration - 500) {
        playTick();
      } else {
        clearInterval(tickInterval);
      }
    }, 80);
    tickIntervalRef.current = tickInterval;

    setTimeout(() => {
      completeSpin(winner);
    }, spinDuration + 100);
  };

  const completeSpin = async (winner: Participant) => {
    setIsTransitioning(false);
    clearInterval(tickIntervalRef.current || undefined);

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

      toast.success(`Selamat! ${w.winner_name} memenangkan ${w.prize_name}!`);

      if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan pemenang');
    } finally {
      setIsSpinning(false);
      pendingWinner.current = null;
    }
  };

  const saveWinnerImage = async () => {
    if (!winnerRef.current || !latestWinner) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(winnerRef.current, { backgroundColor: '#09090b', scale: 2 });
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
      'No': i + 1,
      'Hadiah': w.prize_name,
      'Nama Pemenang': w.winner_name,
      'NIK': w.winner_nik,
      'Waktu': format(new Date(w.drawn_at), 'dd MMM yyyy HH:mm:ss'),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pemenang');
    XLSX.writeFile(wb, `Doorprize_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
  };

  const resetDraw = () => {
    setShowWinner(false);
    setLatestWinner(null);
    setShowConfetti(false);
    setCurrentPrizeIndex(0);
    setDrawComplete(false);
    setWheelRotation(0);
    setPrizes([{ name: '', quantity: 1 }]);
  };

  const currentPrize = prizes[currentPrizeIndex];
  const eligible = getEligible();
  const segAngle = eligible.length > 0 ? 360 / eligible.length : 0;
  const showNamesOnWheel = eligible.length <= 36;
  const fontSize = showNamesOnWheel ? Math.max(8, Math.min(14, Math.floor(280 / eligible.length))) : 0;
  const R = 220;

  const renderWheel = () => {
    if (eligible.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-4">
          <Gift className="w-20 h-20 text-zinc-400/50" />
          <p className="text-lg font-bold">Belum ada peserta</p>
          <p className="text-sm">Tambah peserta via panel samping</p>
        </div>
      );
    }

    const segAngle = 360 / eligible.length;
    const cx = 0, cy = 0;

    const segments = eligible.map((p, i) => {
      const startDeg = i * segAngle;
      const endDeg = (i + 1) * segAngle;
      const startRad = ((startDeg - 90) * Math.PI) / 180;
      const endRad = ((endDeg - 90) * Math.PI) / 180;
      const x1 = cx + R * Math.cos(startRad);
      const y1 = cy + R * Math.sin(startRad);
      const x2 = cx + R * Math.cos(endRad);
      const y2 = cy + R * Math.sin(endRad);
      const largeArc = segAngle > 180 ? 1 : 0;
      const pathD = `M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
      const midDeg = startDeg + segAngle / 2;

      let shortName = p.name;
      if (showNamesOnWheel && segAngle < 20) {
        const maxChars = Math.max(2, Math.floor(segAngle / 2.5));
        shortName = p.name.length > maxChars ? p.name.slice(0, maxChars) + '..' : p.name;
      }

      return { pathD, color, midDeg, name: shortName, nik: p.nik, p };
    });

    const textR = R * 0.65;

    return (
      <svg viewBox="-240 -240 480 480" className="w-full h-full drop-shadow-2xl">
        <defs>
          <filter id="wheelShadow">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodOpacity="0.3" />
          </filter>
        </defs>

        <g ref={wheelRef as any} filter="url(#wheelShadow)">
          {segments.map((seg, i) => (
            <g key={seg.nik}>
              <path d={seg.pathD} fill={seg.color} stroke="#1a1a2e" strokeWidth={1.5} />
            </g>
          ))}
        </g>

        {showNamesOnWheel && (
          <g>
            {segments.map(seg => {
              const midRad = ((seg.midDeg - 90) * Math.PI) / 180;
              const tx = textR * Math.cos(midRad);
              const ty = textR * Math.sin(midRad);
              return (
                <g key={`text-${seg.nik}`}>
                  <text
                    x={tx} y={ty}
                    transform={`rotate(${seg.midDeg}, ${tx}, ${ty})`}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize={fontSize}
                    fontWeight="bold"
                    style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)', pointerEvents: 'none' }}
                  >
                    {seg.name}
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {!showNamesOnWheel && (
          <text x={0} y={0} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={14} fontWeight="bold">
            {eligible.length} peserta
          </text>
        )}

        <g transform="rotate(180)">
          <polygon points="0,-238 -16,-270 16,-270" fill="white" stroke="#7C3AED" strokeWidth="3" />
        </g>
      </svg>
    );
  };

  const currentPrizeLabel = currentPrizeIndex < prizes.length && prizes[currentPrizeIndex]?.name
    ? prizes[currentPrizeIndex].name
    : '-';

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 dark:text-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black flex items-center gap-3">
            <Gift className="w-8 h-8 text-purple-500" />
            Undian Doorprize
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
            Acak pemenang dengan roda undian interaktif
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
        {/* LEFT: Controls */}
        <div className="lg:col-span-1 space-y-6">
          {/* Participant Source */}
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
              <select
                value={selectedProgramId}
                onChange={e => setSelectedProgramId(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-purple-500/20 outline-none"
              >
                <option value="">-- Pilih Program --</option>
                {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}

            {activeTab === 'manual' && (
              <div className="space-y-3">
                <input type="text" placeholder="Nama peserta" value={manualName}
                  onChange={e => setManualName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addManualParticipant()}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-purple-500/20 outline-none" />
                <div className="flex gap-2">
                  <input type="text" placeholder="NIK" value={manualNik}
                    onChange={e => setManualNik(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addManualParticipant()}
                    className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-purple-500/20 outline-none" />
                  <button onClick={addManualParticipant}
                    className="px-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-all active:scale-95">
                    <UserPlus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'excel' && (
              <label className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-2xl cursor-pointer hover:border-purple-500 dark:hover:border-purple-400 transition-colors">
                <Upload className="w-8 h-8 text-zinc-400" />
                <span className="text-sm font-bold text-zinc-500">Upload .xlsx</span>
                <span className="text-xs text-zinc-400">Kolom: Name/NAMA + NIK</span>
                <input type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} className="hidden" />
              </label>
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

            {eligible.length > 36 && (
              <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 rounded-xl">
                <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
                  Terlalu banyak peserta untuk ditampilkan di roda. Nama disembunyikan.
                </p>
              </div>
            )}
          </div>

          {/* Prize List */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <h3 className="text-sm font-black text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-purple-500" />
              Daftar Hadiah
            </h3>

            {prizes.length > 0 && (
              <div className="space-y-2 mb-4 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                {prizes.map((prize, idx) => (
                  <div key={idx}
                    className={`flex items-center justify-between p-3 rounded-xl border ${
                      idx === currentPrizeIndex && !latestWinner && !isSpinning
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                        : idx < currentPrizeIndex
                          ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 opacity-60'
                          : 'border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                        idx < currentPrizeIndex ? 'bg-green-500 text-white'
                          : idx === currentPrizeIndex && !latestWinner && !isSpinning
                            ? 'bg-purple-600 text-white'
                            : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-500'
                      }`}>
                        {idx < currentPrizeIndex ? '✓' : idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate">{prize.name || '(kosong)'}</p>
                        <p className="text-xs text-zinc-400">x{prize.quantity}</p>
                      </div>
                    </div>
                    {prize.name && (
                      <button onClick={() => removePrize(idx)} className="p-1 text-zinc-400 hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input type="text" placeholder="Nama hadiah" value={prizeNameInput}
                onChange={e => setPrizeNameInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addPrize()}
                className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-purple-500/20 outline-none" />
              <input type="number" min={1} value={prizeQtyInput}
                onChange={e => setPrizeQtyInput(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-2 py-2.5 text-sm font-bold text-center focus:ring-2 focus:ring-purple-500/20 outline-none" />
              <button onClick={addPrize}
                className="px-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-all active:scale-95"><Plus className="w-5 h-5" /></button>
            </div>
          </div>

          {/* Spin Button */}
          <button
            onClick={spinWheel}
            disabled={isSpinning || eligibleCount === 0 || prizes.every(p => !p.name) || currentPrizeIndex >= prizes.length}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black rounded-xl shadow-lg shadow-purple-500/30 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 text-lg"
          >
            {isSpinning ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Memutar Roda...</>
            ) : drawComplete ? (
              <><RotateCcw className="w-5 h-5" /> Mulai Ulang</>
            ) : (
              <><Play className="w-5 h-5" /> Putar Roda: {currentPrizeLabel}</>
            )}
          </button>

          {drawComplete && (
            <button onClick={resetDraw} className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-bold rounded-xl transition-all">
              Reset Undian
            </button>
          )}

          {/* Participant List (compact) */}
          {eligible.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-4 border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <h4 className="text-xs font-black text-zinc-400 uppercase tracking-wider mb-2">
                Daftar Peserta ({eligible.length})
              </h4>
              <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-1">
                {eligible.map((p, i) => (
                  <div key={p.nik} className="flex items-center gap-2 text-xs">
                    <span className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-black shrink-0"
                      style={{ backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length], color: 'white' }}>
                      {i + 1}
                    </span>
                    <span className="font-medium truncate">{p.name}</span>
                    <span className="text-zinc-400 shrink-0">{p.nik}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Wheel + Winner Display */}
        <div className="lg:col-span-2 space-y-6">
          <div className="relative bg-white dark:bg-zinc-950 rounded-[2.5rem] p-4 md:p-8 border-4 border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-2xl">
            {/* Background glow */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-500/10 blur-[120px] rounded-full" />
            </div>

            {/* WHEEL */}
            <div className={`relative w-full aspect-square max-w-[500px] mx-auto transition-opacity duration-500 ${showWinner ? 'opacity-30 scale-95' : 'opacity-100 scale-100'}`}>
              <div
                ref={wheelRef}
                style={{ transform: `rotate(${wheelRotation}deg)` }}
                className="w-full h-full"
              >
                {renderWheel()}
              </div>
            </div>

            {/* WINNER OVERLAY */}
            <AnimatePresence>
              {showWinner && latestWinner && (
                <motion.div
                  ref={winnerRef}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ type: 'spring', duration: 0.6 }}
                  className="absolute inset-0 flex flex-col items-center justify-center z-20 p-6"
                >
                  {showConfetti && (
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                      {Array.from({ length: 50 }).map((_, i) => (
                        <motion.div
                          key={i}
                          initial={{ x: '50%', y: '50%', scale: 0, opacity: 1 }}
                          animate={{
                            x: `${50 + (Math.random() - 0.5) * 100}%`,
                            y: `${50 + (Math.random() - 0.5) * 100}%`,
                            scale: [0, 1.2, 0.6],
                            opacity: [1, 1, 0],
                            rotate: Math.random() * 720,
                          }}
                          transition={{ duration: 2 + Math.random() * 1.5, ease: 'easeOut' }}
                          className="absolute w-3 h-3 rounded-sm"
                          style={{ backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length] }}
                        />
                      ))}
                    </div>
                  )}

                  <div className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-purple-600 to-pink-500 rounded-full text-white text-sm font-black uppercase tracking-widest mb-4 shadow-lg">
                    <PartyPopper className="w-4 h-4" />
                    Pemenang
                  </div>

                  <h2 className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-purple-400 via-pink-400 to-orange-300 mb-2 drop-shadow-lg text-center leading-tight">
                    {latestWinner.winner_name}
                  </h2>

                  <div className="inline-block px-5 py-2 bg-black/20 dark:bg-white/10 border border-white/20 rounded-full mb-4">
                    <span className="font-mono text-lg font-bold text-white/90 tracking-widest">
                      {latestWinner.winner_nik}
                    </span>
                  </div>

                  <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-xl inline-flex items-center gap-2 shadow-[0_0_30px_rgba(147,51,234,0.5)]">
                    <Trophy className="w-5 h-5" />
                    <span className="font-bold">Mendapatkan:</span>
                    <span className="font-black text-lg">{latestWinner.prize_name}</span>
                  </div>

                  <div className="mt-5 flex items-center gap-3">
                    <button onClick={saveWinnerImage}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white font-bold rounded-xl transition-all text-sm"
                    >
                      <Image className="w-4 h-4" />
                      Simpan Gambar
                    </button>
                    <button onClick={() => { setShowWinner(false); setLatestWinner(null); setShowConfetti(false); }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-all text-sm"
                    >
                      <Play className="w-4 h-4" />
                      Undian Berikutnya
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Winners History */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <h3 className="text-sm font-black text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Riwayat Pemenang
              {winners.length > 0 && (
                <span className="text-purple-600 dark:text-purple-400 font-black text-xs">({winners.length})</span>
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
                      <p className="text-xs text-zinc-500 truncate">{w.winner_nik} &middot; {w.prize_name}</p>
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
