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

  useEffect(() => {
    if (!user || !profile) return;
    fetchData();
  }, [user, profile]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: allPrograms } = await supabase
        .from('union_programs')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      const { data: myRegs } = await supabase
        .from('program_registrations')
        .select('*, union_programs!inner(name, program_type)')
        .eq('user_id', user?.id);

      if (myRegs) setMyRegistrations(myRegs);

      if (allPrograms && profile) {
        const validPrograms = await Promise.all(allPrograms.map(async (prog) => {
          if (!prog.is_targeted) return prog;

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
    if (program.form_config && program.form_config.length > 0) {
      setActiveFormProgram(program);
      setFormAnswers({});
    } else {
      // Jika tidak ada form khusus, langsung daftar
      executeClaim(program.id, {});
    }
  };

  const executeClaim = async (programId: string, answers = {}) => {
    if (!user) return;
    setClaiming(programId);
    try {
      // Generate Kode Unik Kupon (QR)
      const kuponCode = `${programId.slice(0, 4).toUpperCase()}-${user.id.slice(0, 5).toUpperCase()}-${Math.floor(Math.random() * 10000)}`;

      // Jika program ini punya form kustom, simpan jawabannya
      if (Object.keys(answers).length > 0) {
        const { error: respError } = await supabase.from('program_responses').insert({
          program_id: programId,
          user_id: user.id,
          answers: answers
        });
        if (respError) throw respError;
      }

      // Terbitkan Tanda Terima (Kupon)
      const { error: regError } = await supabase.from('program_registrations').insert({
        program_id: programId,
        user_id: user.id,
        status: 'terdaftar',
        kupon_code: kuponCode
      });
      if (regError) throw regError;

      toast.success('Pendaftaran Berhasil! Kupon Anda telah terbit.');
      setActiveFormProgram(null);
      fetchData();
    } catch (error: any) {
      toast.error('Gagal daftar. Anda mungkin sudah terdaftar di program ini.');
    } finally {
      setClaiming(null);
    }
  };

  const renderDynamicField = (field: any) => {
    switch (field.type) {
      case 'select':
        return (
          <select
            className="w-full p-3 rounded-xl border dark:bg-zinc-800 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            onChange={(e) => setFormAnswers({ ...formAnswers, [field.label]: e.target.value })}
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
            onChange={(e) => setFormAnswers({ ...formAnswers, [field.label]: e.target.value })}
            required={field.required}
          />
        );
      default:
        return (
          <input
            type="text"
            placeholder={`Tulis ${field.label}...`}
            className="w-full p-3 rounded-xl border dark:bg-zinc-800 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            onChange={(e) => setFormAnswers({ ...formAnswers, [field.label]: e.target.value })}
            required={field.required}
          />
        );
    }
  };

  if (!user) return <Navigate to="/login" />;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4 pb-8">
      <div className="max-w-md mx-auto space-y-4">

      {myRegistrations.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800 shadow-sm">
          <h3 className="font-bold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
            <QrCode className="w-5 h-5 text-blue-600" /> Tiket & Tanda Terima
          </h3>
          <div className="space-y-3">
            {myRegistrations.map((reg) => (
              <div key={reg.id} className="p-4 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl border border-blue-100 dark:border-blue-900/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-black text-blue-900 dark:text-blue-100 text-lg">
                      {reg.union_programs?.name}
                    </p>
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">NIK: {profile?.nik}</p>
                  </div>
                  <div className="text-center bg-zinc-50 dark:bg-zinc-800 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700">
                    <p className="text-[10px] uppercase font-bold text-zinc-500">Kode Scan</p>
                    <p className="font-mono font-black text-blue-600 dark:text-blue-400">{reg.kupon_code}</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-blue-200/50 dark:border-blue-800/50 flex justify-between items-center">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${reg.status === 'diambil' ? 'bg-green-200 text-green-800' : 'bg-blue-200 text-blue-800'}`}>
                    Status: {reg.status === 'diambil' ? 'HADIR / DIAMBIL' : 'TERDAFTAR'}
                  </span>
                  <span className="text-xs text-blue-600 dark:text-blue-400">Tunjukkan ke Panitia</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <h3 className="font-bold text-zinc-700 dark:text-zinc-300 mb-3">Program Berlangsung</h3>
      {loading ? (
        <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
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
              <div key={program.id} className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center text-amber-600">
                    {program.is_targeted ? <Users className="w-6 h-6" /> : <Calendar className="w-6 h-6" />}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-zinc-900 dark:text-white">{program.name}</h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{program.description}</p>
                  </div>
                </div>
                <div className="mt-4">
                  {isRegistered ? (
                    <button disabled className="w-full py-2 bg-green-500 text-white rounded-lg font-bold flex items-center justify-center gap-2 opacity-80 cursor-not-allowed">
                      <CheckCircle className="w-4 h-4" /> Kupon Dimiliki
                    </button>
                  ) : (
                    <button
                      onClick={() => handleOpenForm(program)}
                      disabled={claiming === program.id}
                      className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-bold flex items-center justify-center gap-2"
                    >
                      {claiming === program.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ikuti Program"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL: FORMULIR DINAMIS */}
      {activeFormProgram && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="font-black text-lg mb-2">{activeFormProgram.name}</h2>
            <p className="text-xs text-zinc-500 mb-6">Silakan lengkapi data berikut.</p>

            <form onSubmit={(e) => { e.preventDefault(); executeClaim(activeFormProgram.id, formAnswers); }} className="space-y-4">
              {activeFormProgram.form_config?.map((field: any) => (
                <div key={field.id}>
                  <label className="block text-xs font-bold mb-1">
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>
                  {renderDynamicField(field)}
                </div>
              ))}
              <div className="flex gap-2 mt-6">
                <button type="button" onClick={() => setActiveFormProgram(null)} className="flex-1 py-3 bg-zinc-200 dark:bg-zinc-800 font-bold rounded-xl text-zinc-700 dark:text-zinc-300">
                  Batal
                </button>
                <button type="submit" disabled={claiming !== null} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl flex justify-center items-center">
                  {claiming ? <Loader2 className="w-5 h-5 animate-spin" /> : "Kirim Data"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}