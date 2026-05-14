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
        className: 'w-full p-4 rounded-2xl border-2 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 text-sm focus:border-amber-400 focus:ring-0 outline-none transition-all',
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
        className: 'w-full p-4 rounded-2xl border-2 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 text-sm focus:border-amber-400 focus:ring-0 outline-none transition-all',
        onChange: (e: any) => setFormAnswers({ ...formAnswers, [field.label]: e.target.value }),
      });
    }
    return React.createElement('input', {
      type: 'text',
      placeholder: 'Tulis ' + field.label,
      className: 'w-full p-4 rounded-2xl border-2 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 text-sm focus:border-amber-400 focus:ring-0 outline-none transition-all',
      onChange: (e: any) => setFormAnswers({ ...formAnswers, [field.label]: e.target.value }),
    });
  };

  if (!user) return React.createElement(Navigate, { to: '/login' });

  return (
    React.createElement('div', { className: 'pb-8' },
      React.createElement('div', { className: 'max-w-md mx-auto px-4 pt-4 space-y-5' },
        
        React.createElement(motion.div, {
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          className: 'bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 rounded-3xl p-5 shadow-xl shadow-amber-500/20'
        },
          React.createElement('div', { className: 'flex items-center gap-4 mb-4' },
            React.createElement('div', { className: 'w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center' },
              React.createElement(Gift, { className: 'w-7 h-7 text-white' })
            ),
            React.createElement('div', null,
              React.createElement('h2', { className: 'text-lg font-black text-white' }, 'Program Serikat'),
              React.createElement('p', { className: 'text-sm text-white/80' }, 'Kupon, Kurban, Gathering & lainnya')
            )
          ),
          React.createElement('div', { className: 'flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl p-3' },
            React.createElement(Sparkles, { className: 'w-4 h-4 text-white/80' }),
            React.createElement('p', { className: 'text-xs text-white/90' }, 'Ikuti program untuk mendapatkan berbagai benefit dari Serikat Pekerja')
          )
        ),

        myRegistrations.length > 0 && React.createElement(motion.div, {
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          transition: { delay: 0.1 },
          className: 'bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-lg'
        },
          React.createElement('div', { className: 'flex items-center justify-between mb-5' },
            React.createElement('h3', { className: 'font-bold text-zinc-900 dark:text-white flex items-center gap-2' },
              React.createElement(Ticket, { className: 'w-5 h-5 text-amber-500' }),
              'Tiket Pendaftaran'
            ),
            React.createElement('span', { className: 'text-xs font-medium text-zinc-500 bg-amber-100 dark:bg-amber-900/30 px-3 py-1 rounded-xl' },
              myRegistrations.length + ' Tiket'
            )
          ),
          React.createElement('div', { className: 'space-y-3' },
            ...myRegistrations.map((reg) =>
              React.createElement('div', {
                key: reg.id,
                className: 'p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/20 rounded-2xl border border-amber-100 dark:border-amber-800/50'
              },
                React.createElement('div', { className: 'flex items-start justify-between gap-3' },
                  React.createElement('div', null,
                    React.createElement('p', { className: 'font-black text-amber-900 dark:text-amber-100' }, reg.union_programs?.name),
                    React.createElement('p', { className: 'text-xs text-amber-600 dark:text-amber-400 mt-1' }, 'NIK: ' + user?.nik)
                  ),
                  React.createElement('div', { className: 'w-8 h-8 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center' },
                    React.createElement(CheckCircle, { className: 'w-4 h-4 text-green-600' })
                  )
                ),
                React.createElement('div', { className: 'mt-3 p-3 bg-white/60 dark:bg-zinc-800/60 rounded-xl' },
                  React.createElement('p', { className: 'text-xs text-zinc-500 dark:text-zinc-400 mb-1' }, 'Kode Kupon'),
                  React.createElement('p', { className: 'font-black text-lg text-amber-700 dark:text-amber-400 tracking-wider' }, reg.kupon_code)
                )
              )
            )
          )
        ),

        React.createElement('div', { className: 'flex items-center justify-between' },
          React.createElement('h3', { className: 'text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider' }, 'Program Berlangsung'),
          React.createElement('span', { className: 'text-xs font-medium text-zinc-400' }, programs.length + ' Program')
        ),

        loading ?
          React.createElement('div', { className: 'flex justify-center py-12' },
            React.createElement(motion.div, {
              animate: { rotate: 360 },
              transition: { duration: 1, repeat: Infinity, ease: 'linear' },
              className: 'w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full'
            })
          ) :
          programs.length === 0 ?
            React.createElement(motion.div, {
              initial: { opacity: 0, scale: 0.9 },
              animate: { opacity: 1, scale: 1 },
              className: 'text-center py-12 bg-white dark:bg-zinc-900 rounded-3xl shadow-lg'
            },
              React.createElement('div', { className: 'w-20 h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4' },
                React.createElement(Gift, { className: 'w-10 h-10 text-zinc-400' })
              ),
              React.createElement('p', { className: 'text-zinc-500 font-bold text-lg' }, 'Belum Ada Program'),
              React.createElement('p', { className: 'text-xs text-zinc-400 mt-2' }, 'Program dari Serikat akan muncul di sini')
            ) :
            React.createElement('div', { className: 'space-y-4' },
              ...programs.map((program, idx) => {
                const isRegistered = myRegistrations.some((r) => r.program_id === program.id);
                return React.createElement(motion.div, {
                  key: program.id,
                  initial: { opacity: 0, y: 20 },
                  animate: { opacity: 1, y: 0 },
                  transition: { delay: idx * 0.05 },
                  className: 'bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-lg'
                },
                  React.createElement('div', { className: 'flex items-start gap-4' },
                    React.createElement('div', { className: `w-14 h-14 rounded-2xl flex items-center justify-center ${
                      program.is_targeted 
                        ? 'bg-gradient-to-br from-purple-500 to-pink-600' 
                        : 'bg-gradient-to-br from-amber-500 to-orange-600'
                    }` },
                      program.is_targeted 
                        ? React.createElement(Users, { className: 'w-7 h-7 text-white' }) 
                        : React.createElement(Calendar, { className: 'w-7 h-7 text-white' })
                    ),
                    React.createElement('div', { className: 'flex-1' },
                      React.createElement('h4', { className: 'font-bold text-zinc-900 dark:text-white text-lg' }, program.name),
                      React.createElement('p', { className: 'text-sm text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed' }, program.description),
                      program.is_targeted && React.createElement('span', { className: 'inline-block mt-2 px-2.5 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs font-bold rounded-lg' },
                        'Undangan Eksklusif'
                      )
                    )
                  ),
                  React.createElement('div', { className: 'mt-5' },
                    isRegistered ?
                      React.createElement('button', {
                        disabled: true,
                        className: 'w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg'
                      },
                        React.createElement(CheckCircle, { className: 'w-5 h-5' }),
                        'Kupon Dimiliki'
                      ) :
                      React.createElement('button', {
                        onClick: () => handleOpenForm(program),
                        disabled: claiming === program.id,
                        className: 'w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-2xl font-bold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2'
                      },
                        claiming === program.id ?
                          React.createElement(Loader2, { className: 'w-5 h-5 animate-spin' }) :
                          React.createElement(React.Fragment, null,
                            React.createElement(Gift, { className: 'w-5 h-5' }),
                            'Ikuti Program'
                          )
                      )
                  )
                );
              })
            ),

        activeFormProgram && React.createElement('div', { className: 'fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4' },
          React.createElement(motion.div, {
            initial: { scale: 0.9, opacity: 0, y: 20 },
            animate: { scale: 1, opacity: 1, y: 0 },
            className: 'bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto shadow-2xl'
          },
            React.createElement('div', { className: 'flex items-center justify-between mb-6' },
              React.createElement('div', null,
                React.createElement('h2', { className: 'font-black text-xl text-zinc-900 dark:text-white' }, activeFormProgram.name),
                React.createElement('p', { className: 'text-xs text-zinc-500 mt-1' }, 'Silakan lengkapi data berikut')
              ),
              React.createElement('div', { className: 'w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center' },
                React.createElement(Gift, { className: 'w-6 h-6 text-white' })
              )
            ),
            React.createElement('form', {
              onSubmit: (e: any) => { e.preventDefault(); executeClaim(activeFormProgram.id, formAnswers); },
              className: 'space-y-4'
            },
              ...(activeFormProgram.form_config || []).map((field: any) =>
                React.createElement('div', { key: field.id },
                  React.createElement('label', { className: 'block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wider' },
                    field.label,
                    field.required && React.createElement('span', { className: 'text-red-500 ml-1' }, '*')
                  ),
                  renderDynamicField(field)
                )
              ),
              React.createElement('div', { className: 'flex gap-3 mt-6' },
                React.createElement('button', {
                  type: 'button',
                  onClick: () => setActiveFormProgram(null),
                  className: 'flex-1 py-3.5 bg-zinc-100 dark:bg-zinc-800 font-bold rounded-2xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors'
                }, 'Batal'),
                React.createElement('button', {
                  type: 'submit',
                  disabled: claiming !== null,
                  className: 'flex-1 py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all'
                },
                  claiming ? React.createElement(Loader2, { className: 'w-5 h-5 animate-spin inline' }) : 'Kirim Data'
                )
              )
            )
          )
        )
      )
    )
  );
}