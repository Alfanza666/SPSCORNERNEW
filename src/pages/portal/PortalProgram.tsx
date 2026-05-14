import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { Gift, Calendar, Users, CheckCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PortalProgram() {
  const { user, profile } = useAuthStore();
  const [programs, setPrograms] = useState<any[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
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
        className: 'w-full p-3 rounded-xl border dark:bg-zinc-800 dark:border-zinc-700 text-sm',
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
        className: 'w-full p-3 rounded-xl border dark:bg-zinc-800 dark:border-zinc-700 text-sm',
        onChange: (e: any) => setFormAnswers({ ...formAnswers, [field.label]: e.target.value }),
      });
    }
    return React.createElement('input', {
      type: 'text',
      placeholder: 'Tulis ' + field.label,
      className: 'w-full p-3 rounded-xl border dark:bg-zinc-800 dark:border-zinc-700 text-sm',
      onChange: (e: any) => setFormAnswers({ ...formAnswers, [field.label]: e.target.value }),
    });
  };

  if (!user) return React.createElement(Navigate, { to: '/login' });

  return React.createElement('div', { className: 'bg-zinc-50 dark:bg-zinc-950 p-4 pb-8' },
    React.createElement('div', { className: 'max-w-md mx-auto space-y-4' },
      myRegistrations.length > 0 && React.createElement('div', { className: 'bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800 shadow-sm' },
        React.createElement('h3', { className: 'font-bold text-zinc-900 dark:text-white mb-3' }, 'Tiket Pendaftaran'),
        ...myRegistrations.map((reg) =>
          React.createElement('div', { key: reg.id, className: 'p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl border border-blue-100 dark:border-blue-900/30 mb-3' },
            React.createElement('p', { className: 'font-black text-blue-900 dark:text-blue-100' }, reg.union_programs?.name),
            React.createElement('p', { className: 'text-sm text-blue-700 dark:text-blue-300' }, 'NIK: ' + profile?.nik),
            React.createElement('p', { className: 'text-xs font-bold text-blue-600 dark:text-blue-400 mt-2' }, reg.kupon_code)
          )
        )
      ),
      React.createElement('h3', { className: 'font-bold text-zinc-700 dark:text-zinc-300' }, 'Program Berlangsung'),
      loading ?
        React.createElement('div', { className: 'flex justify-center p-8' },
          React.createElement(Loader2, { className: 'w-8 h-8 animate-spin text-blue-500' })
        ) :
        programs.length === 0 ?
          React.createElement('div', { className: 'text-center py-8 bg-white dark:bg-zinc-900 rounded-2xl' },
            React.createElement(Gift, { className: 'w-12 h-12 text-zinc-300 mx-auto mb-3' }),
            React.createElement('p', { className: 'text-zinc-500 text-sm' }, 'Belum ada program untuk Anda saat ini.')
          ) :
          React.createElement('div', { className: 'space-y-3' },
            ...programs.map((program) => {
              const isRegistered = myRegistrations.some((r: any) => r.program_id === program.id);
              return React.createElement('div', { key: program.id, className: 'bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800' },
                React.createElement('div', { className: 'flex items-start gap-3' },
                  React.createElement('div', { className: 'w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center text-amber-600' },
                    program.is_targeted ? React.createElement(Users, { className: 'w-6 h-6' }) : React.createElement(Calendar, { className: 'w-6 h-6' })
                  ),
                  React.createElement('div', { className: 'flex-1' },
                    React.createElement('h4', { className: 'font-bold text-zinc-900 dark:text-white' }, program.name),
                    React.createElement('p', { className: 'text-xs text-zinc-500 dark:text-zinc-400 mt-1' }, program.description)
                  )
                ),
                React.createElement('div', { className: 'mt-4' },
                  isRegistered ?
                    React.createElement('button', { disabled: true, className: 'w-full py-2.5 bg-green-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 opacity-80' },
                      React.createElement(CheckCircle, { className: 'w-4 h-4' }), 'Kupon Dimiliki'
                    ) :
                    React.createElement('button', {
                      onClick: () => handleOpenForm(program),
                      disabled: claiming === program.id,
                      className: 'w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold'
                    }, claiming === program.id ?
                      React.createElement(Loader2, { className: 'w-4 h-4 animate-spin inline' }) :
                      'Ikuti Program'
                    )
                )
              );
            })
          )
      )
    ),
    activeFormProgram && React.createElement('div', { className: 'fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4' },
      React.createElement('div', { className: 'bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto shadow-2xl' },
        React.createElement('h2', { className: 'font-black text-lg mb-2' }, activeFormProgram.name),
        React.createElement('p', { className: 'text-xs text-zinc-500 mb-6' }, 'Silakan lengkapi data berikut.'),
        React.createElement('form', {
          onSubmit: (e: any) => { e.preventDefault(); executeClaim(activeFormProgram.id, formAnswers); },
          className: 'space-y-4'
        },
          ...(activeFormProgram.form_config || []).map((field: any) =>
            React.createElement('div', { key: field.id },
              React.createElement('label', { className: 'block text-xs font-bold mb-1' },
                field.label, field.required && React.createElement('span', { className: 'text-red-500' }, ' *')
              ),
              renderDynamicField(field)
            )
          ),
          React.createElement('div', { className: 'flex gap-2 mt-6' },
            React.createElement('button', {
              type: 'button',
              onClick: () => setActiveFormProgram(null),
              className: 'flex-1 py-3 bg-zinc-200 dark:bg-zinc-800 font-bold rounded-xl text-zinc-700 dark:text-zinc-300'
            }, 'Batal'),
            React.createElement('button', {
              type: 'submit',
              disabled: claiming !== null,
              className: 'flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl'
            }, claiming ? React.createElement(Loader2, { className: 'w-5 h-5 animate-spin inline' }) : 'Kirim Data')
          )
        )
      )
    )
  );
}