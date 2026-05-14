import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import SPSLogo from '../../components/SPSLogo';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { Gift, Calendar, Users, CheckCircle, Loader2, Ticket, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion } from 'motion/react';

interface ProgramRegistration {
  id: string;
  program_id: string;
  user_id: string;
  status: string;
  kupon_code: string;
  union_programs?: {
    name: string;
    program_type: string;
  };
}

interface Program {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  is_targeted: boolean;
  form_config: any[];
}

export default function PortalProgram() {
  const { user } = useAuthStore();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<ProgramRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [activeFormProgram, setActiveFormProgram] = useState<Program | null>(null);
  const [formAnswers, setFormAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

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

      if (allPrograms && user) {
        const validPrograms = await Promise.all(allPrograms.map(async (prog) => {
          if (!prog.is_targeted) return prog;
          const { data: isEligible } = await supabase
            .from('program_eligibility')
            .select('id')
            .eq('program_id', prog.id)
            .eq('nik', user.nik)
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

  const handleOpenForm = (program: Program) => {
    if (program.form_config && program.form_config.length > 0) {
      setActiveFormProgram(program);
      setFormAnswers({});
    } else {
      executeClaim(program.id, {});
    }
  };

  const executeClaim = async (programId: string, answers = {}) => {
    if (!user) return;
    setClaiming(programId);
    try {
      const kuponCode = programId.slice(0, 4).toUpperCase() + '-' + user.id.slice(0, 5).toUpperCase() + '-' + Math.floor(Math.random() * 10000);
      if (Object.keys(answers).length > 0) {
        const { error: respError } = await supabase.from('program_responses').insert({
          program_id: programId,
          user_id: user.id,
          answers: answers
        });
        if (respError) throw respError;
      }
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
    } catch (error) {
      toast.error('Gagal daftar. Anda mungkin sudah terdaftar di program ini.');
    } finally {
      setClaiming(null);
    }
  };

  const renderDynamicField = (field: any) => {
    if (field.type === 'select') {
      return React.createElement('select', {
        className: 'w-full p-4 rounded-2xl border-2 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 text-base focus:border-amber-400 focus:ring-0 outline-none transition-all',
        onChange: (e: any) => setFormAnswers({ ...formAnswers, [field.label]: e.target.value }),
      },
        React.createElement('option', { value: '' }, '-- Pilih ' + field.label + ' --'),
        ...(field.options || '').split(',').map((opt: string) =>
          React.createElement('option', { key: opt.trim(), value: opt.trim() }, opt.trim())
        )
      );
    }
    if (field.type === 'number') {
      return React.createElement('input', {
        type: 'number',
        placeholder: 'Masukkan ' + field.label,
        className: 'w-full p-4 rounded-2xl border-2 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 text-base focus:border-amber-400 focus:ring-0 outline-none transition-all',
        onChange: (e: any) => setFormAnswers({ ...formAnswers, [field.label]: e.target.value }),
      });
    }
    return React.createElement('input', {
      type: 'text',
      placeholder: 'Tulis ' + field.label,
      className: 'w-full p-4 rounded-2xl border-2 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 text-base focus:border-amber-400 focus:ring-0 outline-none transition-all',
      onChange: (e: any) => setFormAnswers({ ...formAnswers, [field.label]: e.target.value }),
    });
  };

  if (!user) return React.createElement(Navigate, { to: '/login' });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
          <Gift className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Program Serikat</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Kupon, Kurban, Gathering & lainnya</p>
        </div>
      </div>

      {/* Info Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/20 rounded-2xl p-4 border border-amber-100 dark:border-amber-900/30"
      >
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">Ikuti program untuk mendapatkan berbagai benefit dari Serikat Pekerja</p>
        </div>
      </motion.div>

      {/* My Tickets */}
      {myRegistrations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 rounded-3xl p-8 border border-zinc-100 dark:border-zinc-800 shadow-lg"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-zinc-900 dark:text-white text-lg flex items-center gap-3">
              <Ticket className="w-5 h-5 text-amber-500" />
              Tiket Pendaftaran Saya
            </h3>
            <span className="text-sm font-medium text-zinc-500 bg-amber-100 dark:bg-amber-900/30 px-4 py-2 rounded-xl">
              {myRegistrations.length} Tiket
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myRegistrations.map((reg) => (
              <div
                key={reg.id}
                className="p-5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/20 rounded-2xl border border-amber-100 dark:border-amber-800/50"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="font-black text-amber-900 dark:text-amber-100 text-lg">{reg.union_programs?.name}</p>
                    <p className="text-sm text-amber-600 dark:text-amber-400">NIK: {user?.nik}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                </div>
                <div className="p-4 bg-white/60 dark:bg-zinc-800/60 rounded-xl">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Kode Kupon</p>
                  <p className="font-black text-xl text-amber-700 dark:text-amber-400 tracking-wider">{reg.kupon_code}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Programs Section */}
      <div>
        <h3 className="text-lg font-bold text-zinc-700 dark:text-zinc-300 mb-6 flex items-center gap-3">
          Program Berlangsung
          <span className="text-sm font-medium text-zinc-400">({programs.length} Program)</span>
        </h3>

        {loading ? (
          <div className="flex justify-center py-20">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full"
            />
          </div>
        ) : programs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-20 bg-white dark:bg-zinc-900 rounded-3xl shadow-lg"
          >
            <div className="w-24 h-24 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-6">
              <Gift className="w-12 h-12 text-zinc-400" />
            </div>
            <p className="text-zinc-500 font-bold text-xl mb-2">Belum Ada Program</p>
            <p className="text-sm text-zinc-400">Program dari Serikat akan muncul di sini</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {programs.map((program, idx) => {
              const isRegistered = myRegistrations.some((r) => r.program_id === program.id);
              return (
                <motion.div
                  key={program.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-100 dark:border-zinc-800 shadow-lg"
                >
                  <div className="flex items-start gap-4 mb-5">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                      program.is_targeted 
                        ? 'bg-gradient-to-br from-purple-500 to-pink-600' 
                        : 'bg-gradient-to-br from-amber-500 to-orange-600'
                    }`}>
                      {program.is_targeted ? (
                        <Users className="w-7 h-7 text-white" />
                      ) : (
                        <Calendar className="w-7 h-7 text-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-zinc-900 dark:text-white text-lg">{program.name}</h4>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">{program.description}</p>
                      {program.is_targeted && (
                        <span className="inline-block mt-2 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs font-bold rounded-lg">
                          Undangan Eksklusif
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-5">
                    {isRegistered ? (
                      <button
                        disabled
                        className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg"
                      >
                        <CheckCircle className="w-5 h-5" />
                        Kupon Dimiliki
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenForm(program)}
                        disabled={claiming === program.id}
                        className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-2xl font-bold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                      >
                        {claiming === program.id ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <Gift className="w-5 h-5" />
                            Ikuti Program
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {activeFormProgram && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto shadow-2xl"
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="font-black text-2xl text-zinc-900 dark:text-white">{activeFormProgram.name}</h2>
                <p className="text-sm text-zinc-500 mt-1">Silakan lengkapi data berikut</p>
              </div>
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <Gift className="w-7 h-7 text-white" />
              </div>
            </div>

            <form
              onSubmit={(e: any) => { e.preventDefault(); executeClaim(activeFormProgram.id, formAnswers); }}
              className="space-y-5"
            >
              {(activeFormProgram.form_config || []).map((field: any) => (
                <div key={field.id}>
                  <label className="block text-sm font-bold text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {renderDynamicField(field)}
                </div>
              ))}

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setActiveFormProgram(null)}
                  className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 font-bold rounded-2xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={claiming !== null}
                  className="flex-1 py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all"
                >
                  {claiming ? <Loader2 className="w-5 h-5 animate-spin inline" /> : 'Kirim Data'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}