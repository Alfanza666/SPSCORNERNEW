import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { supabase } from '../../lib/supabase';
import { ClipboardList, ExternalLink, Lock, ChevronRight, CheckCircle2, Send, Loader2, FileText } from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';

interface SurveyQuestion {
  id: string;
  label: string;
  type: 'text' | 'radio' | 'checkbox' | 'textarea';
  required: boolean;
  options?: string[];
}

interface Survey {
  id: string;
  title: string;
  description?: string;
  form_id?: string;
  external_url?: string;
  questions?: SurveyQuestion[];
}

interface GatheringSurveysProps {
  announcementId: string;
  surveys: Survey[];
  targetNiks: string[];
  targetDepartments: string[];
  userDepartment: string;
}

export default function GatheringSurveys({ announcementId, surveys, targetNiks, targetDepartments, userDepartment }: GatheringSurveysProps) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const isTargeted = !targetNiks || targetNiks.length === 0 || (
    targetNiks.includes(user?.nik || '') ||
    (targetDepartments?.length > 0 && userDepartment && targetDepartments.includes(userDepartment))
  );

  if (!surveys || surveys.length === 0) return null;

  if (!isTargeted) {
    return (
      <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-6 text-center border border-zinc-200 dark:border-zinc-700">
        <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-7 h-7 text-zinc-400" />
        </div>
        <p className="font-bold text-zinc-600 dark:text-zinc-300 text-sm mb-1">Akses Terbatas</p>
        <p className="text-xs text-zinc-400">
          Survei ini hanya dapat diakses oleh anggota yang telah ditentukan oleh pengurus serikat.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
          <ClipboardList className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-zinc-900 dark:text-white text-sm">Survei Gathering</h3>
          <p className="text-[10px] text-zinc-400 font-medium">{surveys.length} survei tersedia</p>
        </div>
      </div>

      <div className="space-y-3">
        {surveys.map((survey, idx) => (
          <SurveyCard
            key={survey.id}
            survey={survey}
            announcementId={announcementId}
            idx={idx}
            user={user}
            navigate={navigate}
          />
        ))}
      </div>
    </div>
  );
}

function SurveyCard({ survey, announcementId, idx, user, navigate }: {
  key?: string;
  survey: Survey;
  announcementId: string;
  idx: number;
  user: any;
  navigate: any;
}) {
  const hasInlineQuestions = survey.questions && survey.questions.length > 0;
  const hasFormLink = !!survey.form_id;
  const hasExternalLink = !!survey.external_url;

  const [showForm, setShowForm] = useState(false);
  const [answers, setAnswers] = useState<Record<string, any>>(() => {
    if (!hasInlineQuestions) return {};
    const initial: Record<string, any> = {};
    survey.questions!.forEach(q => {
      if (q.type === 'checkbox') initial[q.id] = [];
      else initial[q.id] = '';
    });
    return initial;
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [checkingSubmission, setCheckingSubmission] = useState(true);

  // Check if user already submitted this survey
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { setCheckingSubmission(false); return; }
      const { data } = await supabase
        .from('announcement_survey_responses')
        .select('id')
        .eq('announcement_id', announcementId)
        .eq('survey_id', survey.id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!cancelled) {
        if (data) setSubmitted(true);
        setCheckingSubmission(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, announcementId, survey.id]);

  const handleOpenSurvey = () => {
    if (hasInlineQuestions) {
      setShowForm(true);
    } else if (survey.form_id) {
      navigate(`/portal/forms/${survey.form_id}`);
    } else if (survey.external_url) {
      window.open(survey.external_url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const missing = (survey.questions || []).filter(q => {
      if (!q.required) return false;
      if (q.type === 'checkbox') return !answers[q.id] || answers[q.id].length === 0;
      return !answers[q.id]?.trim();
    });

    if (missing.length > 0) {
      toast.error(`Lengkapi pertanyaan wajib: ${missing.map(q => q.label || 'Pertanyaan').join(', ')}`);
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('announcement_survey_responses')
        .insert({
          announcement_id: announcementId,
          survey_id: survey.id,
          user_id: user.id,
          answers,
        });
      if (error) throw error;
      setSubmitted(true);
      toast.success('Survei berhasil dikirim!');
    } catch (error: any) {
      toast.error('Gagal mengirim: ' + (error.message || ''));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckboxChange = (qId: string, option: string, checked: boolean) => {
    setAnswers(prev => {
      const current = prev[qId] || [];
      if (checked) return { ...prev, [qId]: [...current, option] };
      return { ...prev, [qId]: current.filter((o: string) => o !== option) };
    });
  };

  if (checkingSubmission) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
      </div>
    );
  }

  if (showForm && hasInlineQuestions) {
    if (submitted) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 bg-white dark:bg-zinc-800/50 rounded-2xl border border-green-200 dark:border-green-800 text-center"
        >
          <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-7 h-7 text-green-600" />
          </div>
          <p className="font-bold text-zinc-900 dark:text-white text-sm">{survey.title}</p>
          <p className="text-xs text-zinc-500 mt-1">Terima kasih, jawaban Anda sudah tercatat.</p>
        </motion.div>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden"
      >
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-500">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-sm text-zinc-900 dark:text-white">{survey.title}</p>
              {survey.description && (
                <p className="text-xs text-zinc-400">{survey.description}</p>
              )}
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {(survey.questions || []).map((q) => (
            <div key={q.id}>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                {q.label || 'Pertanyaan'}
                {q.required && <span className="text-red-500 ml-0.5">*</span>}
              </label>

              {q.type === 'text' && (
                <input
                  type="text"
                  value={answers[q.id] || ''}
                  onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                  className="w-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Ketik jawaban..."
                />
              )}

              {q.type === 'textarea' && (
                <textarea
                  value={answers[q.id] || ''}
                  onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                  className="w-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl px-4 py-2.5 text-sm h-24 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Ketik jawaban..."
                />
              )}

              {q.type === 'radio' && (
                <div className="space-y-1.5">
                  {(q.options || []).map((opt, oIdx) => (
                    <label
                      key={oIdx}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        answers[q.id] === opt
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/10'
                          : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900'
                      }`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        value={opt}
                        checked={answers[q.id] === opt}
                        onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                        className="w-4 h-4 accent-purple-500"
                      />
                      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {q.type === 'checkbox' && (
                <div className="space-y-1.5">
                  {(q.options || []).map((opt, oIdx) => (
                    <label
                      key={oIdx}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        (answers[q.id] || []).includes(opt)
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/10'
                          : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={(answers[q.id] || []).includes(opt)}
                        onChange={(e) => handleCheckboxChange(q.id, opt, e.target.checked)}
                        className="w-4 h-4 accent-purple-500 rounded"
                      />
                      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{opt}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-all"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {submitting ? 'Mengirim...' : 'Kirim Survei'}
          </button>
        </form>
      </motion.div>
    );
  }

  // Already submitted — show success state
  if (submitted && hasInlineQuestions) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 bg-white dark:bg-zinc-800/50 rounded-2xl border border-green-200 dark:border-green-800 text-center"
      >
        <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
          <CheckCircle2 className="w-7 h-7 text-green-600" />
        </div>
        <p className="font-bold text-zinc-900 dark:text-white text-sm">{survey.title}</p>
        <p className="text-xs text-zinc-500 mt-1">Terima kasih, jawaban Anda sudah tercatat.</p>
      </motion.div>
    );
  }

  return (
    <motion.button
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.08 }}
      onClick={handleOpenSurvey}
      className="w-full flex items-center gap-4 p-4 bg-white dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-700 hover:border-purple-200 dark:hover:border-purple-800 transition-all group text-left active:scale-[0.98]"
    >
      <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-500 dark:text-purple-400 shrink-0 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/30 transition-colors">
        {hasInlineQuestions ? <FileText className="w-5 h-5" /> : hasExternalLink ? <ExternalLink className="w-5 h-5" /> : <ClipboardList className="w-5 h-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm text-zinc-900 dark:text-white truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
          {survey.title}
        </p>
        {survey.description && (
          <p className="text-[10px] text-zinc-400 truncate mt-0.5">{survey.description}</p>
        )}
        {hasInlineQuestions && (
          <p className="text-[10px] text-purple-500 font-bold mt-0.5">{survey.questions!.length} pertanyaan</p>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-purple-500 transition-colors shrink-0" />
    </motion.button>
  );
}
