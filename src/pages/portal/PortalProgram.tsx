import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { Gift, Calendar, Users, CheckCircle, Loader2, QrCode } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PortalProgram() {
  const { user, profile } = useAuthStore();
  const [programs, setPrograms] = useState<any[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  // State untuk Modal Formulir Dinamis
  const [activeFormProgram, setActiveFormProgram] = useState<any | null>(null);
  const [formAnswers, setFormAnswers] = useState<Record<string, string>>({});
  const [extraFamily, setExtraFamily] = useState(0);

  useEffect(() => {
    if (!user || !profile) return;
    fetchData();
  }, [user, profile]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Ambil semua program aktif
      const { data: allPrograms } = await supabase
        .from('union_programs')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      // 2. Ambil pendaftaran saya untuk QR Code
      const { data: myRegs } = await supabase
        .from('program_registrations')
        .select('*, union_programs!inner(name, program_type)')
        .eq('user_id', user?.id);

      if (myRegs) setMyRegistrations(myRegs);

      // 3. Filter Program (Berdasarkan Target NIK)
      if (allPrograms && profile) {
        const validPrograms = await Promise.all(allPrograms.map(async (prog) => {
          if (!prog.is_targeted) return prog; // Jika untuk umum, loloskan
          
          // Jika targeted, cek tabel eligibility
          const { data: isEligible } = await supabase
            .from('program_eligibility')
            .select('id')
            .eq('program_id', prog.id)
            .eq('nik', profile.nik)
            .maybeSingle();
            
          return isEligible ? prog : null;
        }));
        setPrograms(validPrograms.filter(p => p !== null));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenForm = (program: any) => {
    // Periksa apakah program ini punya pertanyaan kustom
    if (program.form_config && program.form_config.length > 0) {
      setActiveFormProgram(program);
      setFormAnswers({});
      setExtraFamily(0);
    } else {
      // Jika tidak ada form khusus (misal Kurban biasa), langsung klaim
      executeClaim(program.id, {}, 0);
    }
  };

  const executeClaim = async (programId: string, answers = {}, extraFam = 0) => {
    if (!user) return;
    setClaiming(programId);
    try {
      // Generate Kode Unik untuk Tanda Terima (QR)
      const kuponCode = `${programId.slice(0, 4).toUpperCase()}-${user.id.slice(0, 5).toUpperCase()}-${Math.floor(Math.random() * 10000)}`;

      // Jika ada jawaban form dinamis, simpan ke program_responses
      if (Object.keys(answers).length > 0 || extraFam > 0) {
        const feePerFamily = 50000; // Hardcode biaya tambahan keluarga, bisa disesuaikan
        const totalFee = extraFam * feePerFamily;
        
        const { error: respError } = await supabase.from('program_responses').insert({
          program_id: programId,
          user_id: user.id,
          answers: answers,
          additional_family: extraFam,
          total_fee: totalFee,
          payment_status: totalFee > 0 ? 'pending' : 'free'
        });
        if (respError) throw respError;
      }

      // Selalu simpan pendaftaran utama untuk memunculkan QR Code Tanda Terima
      const { error: regError } = await supabase.from('program_registrations').insert({
        program_id: programId,
        user_id: user.id,
        status: 'terdaftar',
        kupon_code: kuponCode
      });
      if (regError) throw regError;

      toast.success('Pendaftaran Berhasil!');
      setActiveFormProgram(null);
      fetchData();
    } catch (error: any) {
      toast.error('Gagal daftar. Anda mungkin sudah terdaftar di program ini.');
    } finally {
      setClaiming(null);
    }
  };

  // --- LOGIKA RENDER INPUT DINAMIS ---
  const renderDynamicField = (field: any) => {
    switch (field.type) {
      case 'select':
        return (
          <select 
            className="w-full p-3 rounded-xl border dark:bg-zinc-800 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            onChange={(e) => setFormAnswers({...formAnswers, [field.label]: e.target.value})}
            required={field.required}
          >
            <option value="">-- Pilih {field.label} --</option>
            {field.options?.split(',').map((opt: string) => (
              <option key={opt.trim()} value={opt.trim()}>{opt.trim()}</option>
            ))}
          </select>
        );
      case 'number':
        return (
          <input 
            type="number"
            placeholder={`Masukkan ${field.label}...`}
            className="w-full p-3 rounded-xl border dark:bg-zinc-800 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            onChange={(e) => setFormAnswers({...formAnswers, [field.label]: e.target.value})}
            required={field.required}
          />
        );
      default:
        return (
          <input 
            type="text"
            placeholder={`Tulis ${field.label}...`}
            className="w-full p-3 rounded-xl border dark:bg-zinc-800 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            onChange={(e) => setFormAnswers({...formAnswers, [field.label]: e.target.value})}
            required={field.required}
          />
        );
    }
  };

  if (!user) return <Navigate to="/login" />;

  return (
    <div className="min-h-screen bg-[#e8ebf2] dark:bg-zinc-950 p-4">
      
      {/* SECTION: TANDA TERIMA (QR CODE) */}
      {myRegistrations.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 mb-6 border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h3 className="font-bold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
            <QrCode className="w-5 h-5 text-blue-600"/> Tanda Terima Anda
          </h3>
          <div className="space-y-3">
            {myRegistrations.map((reg) => (
              <div key={reg.id} className="p-4 bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10 rounded-xl border border-blue-100 dark:border-blue-900/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-black text-blue-900 dark:text-blue-100 text-lg">
                      {reg.union_programs?.name}
                    </p>
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">NIK: {profile?.nik}</p>
                  </div>
                  <div className="text-center bg-white dark:bg-zinc-950 px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-800 shadow-inner">
                    <p className="text-[10px] uppercase font-bold text-zinc-500">Kode Scan</p>
                    <p className="font-mono font-black text-blue-600 dark:text-blue-400">{reg.kupon_code}</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-blue-200/50 dark:border-blue-800/50 flex justify-between items-center">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${reg.status === 'diambil' ? 'bg-green-200 text-green-800' : 'bg-blue-200 text-blue-800'}`}>
                    Status: {reg.status.toUpperCase()}
                  </span>
                  <span className="text-xs text-blue-600 dark:text-blue-400">Tunjukkan ke Pengurus SPS</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION: DAFTAR PROGRAM TERSEDIA */}
      <h3 className="font-bold text-zinc-700 dark:text-zinc-300 mb-3">Program Berlangsung</h3>
      {loading ? (
        <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-blue-500"/></div>
      ) : programs.length === 0 ? (
        <div className="text-center py-8 bg-white dark:bg-zinc-900 rounded-xl">
          <Gift className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">Belum ada program untuk Anda saat ini.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {programs.map((program) => {
            const isRegistered = myRegistrations.some(r => r.program_id === program.id);
            return (
              <div key={program.id} className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex
