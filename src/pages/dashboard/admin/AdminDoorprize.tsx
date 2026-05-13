import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Gift, Play, Trophy, Users, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminDoorprize() {
    const [programs, setPrograms] = useState<any[]>([]);
    const [selectedProgramId, setSelectedProgramId] = useState<string>('');
    const [attendees, setAttendees] = useState<any[]>([]);

    const [isSpinning, setIsSpinning] = useState(false);
    const [winner, setWinner] = useState<any | null>(null);
    const [currentName, setCurrentName] = useState<string>('Siap Mengacak...');

    useEffect(() => {
        fetchPrograms();
    }, []);

    useEffect(() => {
        if (selectedProgramId) fetchAttendees(selectedProgramId);
    }, [selectedProgramId]);

    const fetchPrograms = async () => {
        const { data } = await supabase.from('union_programs').select('id, name').order('created_at', { ascending: false });
        if (data) setPrograms(data);
    };

    const fetchAttendees = async (programId: string) => {
        // Ambil HANYA yang statusnya 'diambil' (sudah discan / hadir)
        const { data } = await supabase
            .from('program_registrations')
            .select('id, profiles(name, nik)')
            .eq('program_id', programId)
            .eq('status', 'diambil');

        if (data) setAttendees(data);
        setWinner(null);
        setCurrentName(data && data.length > 0 ? 'Siap Mengacak...' : 'Belum ada yang hadir');
    };

    const handleSpin = () => {
        if (attendees.length === 0) return toast.error("Belum ada peserta yang hadir (di-scan).");
        if (attendees.length === 1) return toast.error("Peserta kurang dari 2 orang.");

        setIsSpinning(true);
        setWinner(null);

        let duration = 3000; // Putar selama 3 detik
        let intervalTime = 50;

        const interval = setInterval(() => {
            const randomIndex = Math.floor(Math.random() * attendees.length);
            setCurrentName(attendees[randomIndex].profiles.name);
        }, intervalTime);

        setTimeout(() => {
            clearInterval(interval);
            // Tentukan Pemenang Akhir
            const finalWinner = attendees[Math.floor(Math.random() * attendees.length)];
            setWinner(finalWinner);
            setCurrentName(finalWinner.profiles.name);
            setIsSpinning(false);

            // Hujan Confetti / Efek Sukses
            toast.success(`Selamat kepada ${finalWinner.profiles.name}!`, { icon: '🎉', duration: 5000 });
        }, duration);
    };

    return (
        <div className="p-4 md:p-8 min-h-[80vh] flex flex-col items-center justify-center">
            <div className="text-center mb-8 w-full max-w-xl">
                <h1 className="text-3xl font-black text-zinc-900 dark:text-white flex items-center justify-center gap-3 mb-2">
                    <Gift className="w-8 h-8 text-blue-600" /> SPS Doorprize Picker
                </h1>
                <p className="text-zinc-500">Acak pemenang dari peserta yang sudah memindai kehadiran.</p>

                <div className="mt-6">
                    <select
                        value={selectedProgramId}
                        onChange={e => setSelectedProgramId(e.target.value)}
                        className="w-full p-4 rounded-2xl border-2 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 font-bold text-center focus:ring-4 focus:ring-blue-500/20"
                    >
                        <option value="">-- Pilih Program / Acara --</option>
                        {programs.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {selectedProgramId && (
                <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden p-8 text-center relative">

                    <div className="mb-4 inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-full font-bold text-sm">
                        <Users className="w-4 h-4" /> Total Peserta Hadir: {attendees.length} Orang
                    </div>

                    <div className="h-48 flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 rounded-3xl border-4 border-dashed border-zinc-200 dark:border-zinc-800 my-8 overflow-hidden relative">
                        <h2 className={`text-4xl md:text-5xl font-black px-4 transition-all duration-75 ${isSpinning ? 'text-zinc-400 blur-[1px]' : winner ? 'text-green-600 scale-110' : 'text-zinc-800 dark:text-zinc-200'}`}>
                            {currentName}
                        </h2>
                    </div>

                    {winner && (
                        <div className="animate-in slide-in-from-bottom-4 fade-in mb-8">
                            <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-1">Pemenang Doorprize</p>
                            <div className="inline-flex items-center gap-3 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-6 py-3 rounded-2xl border border-amber-200 dark:border-amber-800/50">
                                <Trophy className="w-6 h-6" />
                                <div className="text-left">
                                    <p className="font-black text-xl leading-none">{winner.profiles.name}</p>
                                    <p className="text-xs font-mono font-bold">NIK: {winner.profiles.nik}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handleSpin}
                        disabled={isSpinning || attendees.length === 0}
                        className={`w-full py-5 rounded-2xl font-black text-xl flex items-center justify-center gap-3 transition-all ${isSpinning ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed' :
                            'bg-blue-600 hover:bg-blue-700 hover:scale-[1.02] active:scale-95 text-white shadow-xl shadow-blue-600/30'
                            }`}
                    >
                        {isSpinning ? (
                            <><Loader2 className="w-6 h-6 animate-spin" /> MENGACAK...</>
                        ) : (
                            <><Play className="w-6 h-6 fill-white" /> PUTAR SEKARANG</>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}